import crypto from "node:crypto";
import type { DelegationAuditEvent, SpaceAdminAssignment } from "@escapehatch/shared";
import { withDb } from "../db/client.js";

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function mapAssignment(row: {
  id: string;
  hub_id: string;
  server_id: string;
  assigned_user_id: string;
  assigned_by_user_id: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}): SpaceAdminAssignment {
  return {
    id: row.id,
    hubId: row.hub_id,
    serverId: row.server_id,
    assignedUserId: row.assigned_user_id,
    assignedByUserId: row.assigned_by_user_id,
    status: row.status === "revoked" || row.status === "expired" ? row.status : "active",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAudit(row: {
  id: string;
  action_type: string;
  actor_user_id: string;
  target_user_id: string | null;
  assignment_id: string | null;
  hub_id: string | null;
  server_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}): DelegationAuditEvent {
  const actionType =
    row.action_type === "space_admin_revoked"
      ? "space_admin_revoked"
      : row.action_type === "space_admin_transfer_started"
        ? "space_admin_transfer_started"
        : row.action_type === "space_admin_transfer_completed"
          ? "space_admin_transfer_completed"
          : "space_admin_assigned";

  return {
    id: row.id,
    actionType,
    actorUserId: row.actor_user_id,
    targetUserId: row.target_user_id,
    assignmentId: row.assignment_id,
    hubId: row.hub_id,
    serverId: row.server_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

async function insertDelegationAudit(input: {
  actionType: DelegationAuditEvent["actionType"];
  actorUserId: string;
  targetUserId?: string;
  assignmentId?: string;
  hubId?: string;
  serverId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await withDb(async (db) => {
    await db.query(
      `insert into delegation_audit_events
       (id, action_type, actor_user_id, target_user_id, assignment_id, hub_id, server_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        randomId("dae"),
        input.actionType,
        input.actorUserId,
        input.targetUserId ?? null,
        input.assignmentId ?? null,
        input.hubId ?? null,
        input.serverId ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  });
}

export async function assignSpaceAdmin(input: {
  actorUserId: string;
  assignedUserId: string;
  serverId: string;
  expiresAt?: string;
}): Promise<SpaceAdminAssignment> {
  return withDb(async (db) => {
    const server = await db.query<{ hub_id: string }>("select hub_id from servers where id = $1 limit 1", [
      input.serverId
    ]);
    const hubId = server.rows[0]?.hub_id;
    if (!hubId) {
      throw new Error("Server not found.");
    }

    const row = await db.query<{
      id: string;
      hub_id: string;
      server_id: string;
      assigned_user_id: string;
      assigned_by_user_id: string;
      status: string;
      expires_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `insert into space_admin_assignments
       (id, hub_id, server_id, assigned_user_id, assigned_by_user_id, status, expires_at)
       values ($1, $2, $3, $4, $5, 'active', $6::timestamptz)
       on conflict (server_id, assigned_user_id)
       do update set
         status = 'active',
         assigned_by_user_id = excluded.assigned_by_user_id,
         expires_at = excluded.expires_at,
         updated_at = now()
       returning *`,
      [
        randomId("saa"),
        hubId,
        input.serverId,
        input.assignedUserId,
        input.actorUserId,
        input.expiresAt ?? null
      ]
    );

    const assignment = row.rows[0];
    if (!assignment) {
      throw new Error("Space admin assignment failed.");
    }

    await insertDelegationAudit({
      actionType: "space_admin_assigned",
      actorUserId: input.actorUserId,
      targetUserId: input.assignedUserId,
      assignmentId: assignment.id,
      hubId,
      serverId: input.serverId
    });

    return mapAssignment(assignment);
  });
}

export async function listSpaceAdminAssignments(serverId: string): Promise<SpaceAdminAssignment[]> {
  await expireSpaceAdminAssignments({ serverId });
  return withDb(async (db) => {
    const rows = await db.query<{
      id: string;
      hub_id: string;
      server_id: string;
      assigned_user_id: string;
      assigned_by_user_id: string;
      status: string;
      expires_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `select id, hub_id, server_id, assigned_user_id, assigned_by_user_id, status, expires_at, created_at, updated_at
       from space_admin_assignments
       where server_id = $1
       order by created_at asc`,
      [serverId]
    );
    return rows.rows.map(mapAssignment);
  });
}

export async function expireSpaceAdminAssignments(input: {
  serverId?: string;
  productUserId?: string;
}): Promise<number> {
  return withDb(async (db) => {
    const rows = await db.query<{
      id: string;
      hub_id: string;
      server_id: string;
      assigned_user_id: string;
    }>(
      `update space_admin_assignments
       set status = 'expired', updated_at = now()
       where status = 'active'
         and expires_at is not null
         and expires_at <= now()
         and ($1::text is null or server_id = $1)
         and ($2::text is null or assigned_user_id = $2)
       returning id, hub_id, server_id, assigned_user_id`,
      [input.serverId ?? null, input.productUserId ?? null]
    );

    for (const expired of rows.rows) {
      await db.query(
        `insert into delegation_audit_events
         (id, action_type, actor_user_id, target_user_id, assignment_id, hub_id, server_id, metadata)
         values ($1, 'space_admin_revoked', $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          randomId("dae"),
          "system",
          expired.assigned_user_id,
          expired.id,
          expired.hub_id,
          expired.server_id,
          JSON.stringify({ reason: "expired" })
        ]
      );
    }

    return rows.rowCount ?? 0;
  });
}

export async function hasActiveSpaceAdminAssignment(input: {
  productUserId: string;
  serverId: string;
}): Promise<boolean> {
  await expireSpaceAdminAssignments({ serverId: input.serverId, productUserId: input.productUserId });
  return withDb(async (db) => {
    const row = await db.query<{ active: boolean }>(
      `select exists(
         select 1
         from space_admin_assignments
         where server_id = $1
           and assigned_user_id = $2
           and status = 'active'
           and (expires_at is null or expires_at > now())
       ) as active`,
      [input.serverId, input.productUserId]
    );
    return Boolean(row.rows[0]?.active);
  });
}

export async function revokeSpaceAdminAssignment(input: {
  actorUserId: string;
  assignmentId: string;
}): Promise<{ assignedUserId: string; serverId: string; hubId: string } | null> {
  return withDb(async (db) => {
    const row = await db.query<{
      id: string;
      hub_id: string;
      server_id: string;
      assigned_user_id: string;
    }>(
      `update space_admin_assignments
       set status = 'revoked', updated_at = now()
       where id = $1 and status = 'active'
       returning id, hub_id, server_id, assigned_user_id`,
      [input.assignmentId]
    );

    const assignment = row.rows[0];
    if (!assignment) {
      return null;
    }

    await insertDelegationAudit({
      actionType: "space_admin_revoked",
      actorUserId: input.actorUserId,
      targetUserId: assignment.assigned_user_id,
      assignmentId: assignment.id,
      hubId: assignment.hub_id,
      serverId: assignment.server_id
    });

    return {
      assignedUserId: assignment.assigned_user_id,
      serverId: assignment.server_id,
      hubId: assignment.hub_id
    };
  });
}

export async function listDelegationAuditEvents(input: {
  hubId: string;
  limit?: number;
}): Promise<DelegationAuditEvent[]> {
  return withDb(async (db) => {
    const rows = await db.query<{
      id: string;
      action_type: string;
      actor_user_id: string;
      target_user_id: string | null;
      assignment_id: string | null;
      hub_id: string | null;
      server_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>(
      `select id, action_type, actor_user_id, target_user_id, assignment_id, hub_id, server_id, metadata, created_at
       from delegation_audit_events
       where hub_id = $1
       order by created_at desc
       limit $2`,
      [input.hubId, input.limit ?? 50]
    );
    return rows.rows.map(mapAudit);
  });
}

export async function transferSpaceOwnership(input: {
  actorUserId: string;
  serverId: string;
  newOwnerUserId: string;
}): Promise<{ serverId: string; hubId: string; previousOwnerUserId: string; newOwnerUserId: string }> {
  return withDb(async (db) => {
    const server = await db.query<{ hub_id: string; owner_user_id: string }>(
      "select hub_id, owner_user_id from servers where id = $1 limit 1",
      [input.serverId]
    );
    const existing = server.rows[0];
    if (!existing) {
      throw new Error("Server not found.");
    }

    await insertDelegationAudit({
      actionType: "space_admin_transfer_started",
      actorUserId: input.actorUserId,
      targetUserId: input.newOwnerUserId,
      hubId: existing.hub_id,
      serverId: input.serverId,
      metadata: { previousOwnerUserId: existing.owner_user_id }
    });

    await db.query("update servers set owner_user_id = $2 where id = $1", [input.serverId, input.newOwnerUserId]);

    await insertDelegationAudit({
      actionType: "space_admin_transfer_completed",
      actorUserId: input.actorUserId,
      targetUserId: input.newOwnerUserId,
      hubId: existing.hub_id,
      serverId: input.serverId,
      metadata: { previousOwnerUserId: existing.owner_user_id, newOwnerUserId: input.newOwnerUserId }
    });

    return {
      serverId: input.serverId,
      hubId: existing.hub_id,
      previousOwnerUserId: existing.owner_user_id,
      newOwnerUserId: input.newOwnerUserId
    };
  });
}
