import crypto from "node:crypto";
import type { ModerationAction, ModerationReport, ReportStatus, Role } from "@escapehatch/shared";
import { withDb } from "../db/client.js";
import { executePrivilegedAction } from "./privileged-gateway.js";

interface BaseModerationInput {
  actorUserId: string;
  serverId: string;
  channelId?: string;
  targetUserId?: string;
  targetMessageId?: string;
  reason: string;
}

export async function setChannelControls(input: {
  actorUserId: string;
  serverId: string;
  channelId: string;
  lock?: boolean;
  slowModeSeconds?: number;
  postingRestrictedToRoles?: Role[];
  reason: string;
}): Promise<void> {
  if (typeof input.lock === "boolean") {
    await executePrivilegedAction({
      actorUserId: input.actorUserId,
      action: input.lock ? "channel.lock" : "channel.unlock",
      scope: { serverId: input.serverId, channelId: input.channelId },
      reason: input.reason,
      run: async () => {
        await withDb(async (db) => {
          await db.query("update channels set is_locked = $1 where id = $2 and server_id = $3", [
            input.lock,
            input.channelId,
            input.serverId
          ]);
        });
      }
    });
  }

  if (typeof input.slowModeSeconds === "number") {
    await executePrivilegedAction({
      actorUserId: input.actorUserId,
      action: "channel.slowmode",
      scope: { serverId: input.serverId, channelId: input.channelId },
      reason: input.reason,
      metadata: { slowModeSeconds: input.slowModeSeconds },
      run: async () => {
        await withDb(async (db) => {
          await db.query("update channels set slow_mode_seconds = $1 where id = $2 and server_id = $3", [
            input.slowModeSeconds,
            input.channelId,
            input.serverId
          ]);
        });
      }
    });
  }

  if (input.postingRestrictedToRoles) {
    await executePrivilegedAction({
      actorUserId: input.actorUserId,
      action: "channel.posting",
      scope: { serverId: input.serverId, channelId: input.channelId },
      reason: input.reason,
      metadata: { roles: input.postingRestrictedToRoles },
      run: async () => {
        await withDb(async (db) => {
          await db.query(
            "update channels set posting_restricted_to_roles = $1 where id = $2 and server_id = $3",
            [input.postingRestrictedToRoles, input.channelId, input.serverId]
          );
        });
      }
    });
  }
}

export async function performModerationAction(
  input: BaseModerationInput & { action: "kick" | "ban" | "unban" | "timeout" | "redact_message"; timeoutSeconds?: number }
): Promise<void> {
  const actionMap = {
    kick: "moderation.kick",
    ban: "moderation.ban",
    unban: "moderation.unban",
    timeout: "moderation.timeout",
    redact_message: "moderation.redact"
  } as const;

  await executePrivilegedAction({
    actorUserId: input.actorUserId,
    action: actionMap[input.action],
    scope: { serverId: input.serverId, channelId: input.channelId },
    reason: input.reason,
    targetUserId: input.targetUserId,
    targetMessageId: input.targetMessageId,
    metadata: input.timeoutSeconds ? { timeoutSeconds: input.timeoutSeconds } : undefined,
    run: async () => {
      const { kickUser, banUser, unbanUser, redactEvent } = await import("../matrix/synapse-adapter.js");

      const matrixIds = await withDb(async (db) => {
        let channelMatrixId: string | null = null;
        if (input.channelId) {
          const chRow = await db.query<{ matrix_room_id: string }>(
            "select matrix_room_id from channels where id = $1",
            [input.channelId]
          );
          channelMatrixId = chRow.rows[0]?.matrix_room_id ?? null;
        }

        const srvRow = await db.query<{ matrix_space_id: string }>(
          "select matrix_space_id from servers where id = $1",
          [input.serverId]
        );
        const serverMatrixId = srvRow.rows[0]?.matrix_space_id ?? null;

        return { channelMatrixId, serverMatrixId };
      });

      if (!matrixIds.serverMatrixId) {
        throw new Error("Target server has no associated Matrix Space ID.");
      }

      // For kick/ban, we usually act on the Server (Space)
      // For message redaction, we act on the Channel (Room)

      switch (input.action) {
        case "kick":
          if (!input.targetUserId) throw new Error("targetUserId is required for kick");
          await kickUser({
            roomId: matrixIds.serverMatrixId,
            userId: input.targetUserId,
            reason: input.reason
          });
          break;
        case "ban":
          if (!input.targetUserId) throw new Error("targetUserId is required for ban");
          await banUser({
            roomId: matrixIds.serverMatrixId,
            userId: input.targetUserId,
            reason: input.reason
          });
          break;
        case "unban":
          if (!input.targetUserId) throw new Error("targetUserId is required for unban");
          await unbanUser({
            roomId: matrixIds.serverMatrixId,
            userId: input.targetUserId,
            reason: input.reason
          });
          break;
        case "redact_message":
          if (!input.targetMessageId) throw new Error("targetMessageId is required for redact");
          if (!matrixIds.channelMatrixId) throw new Error("Channel has no associated Matrix Room ID.");
          await redactEvent({
            roomId: matrixIds.channelMatrixId,
            eventId: input.targetMessageId,
            reason: input.reason
          });
          break;
        case "timeout":
          // Timeout implementation: kick from server with reason
          if (!input.targetUserId) throw new Error("targetUserId is required for timeout");
          await kickUser({
            roomId: matrixIds.serverMatrixId,
            userId: input.targetUserId,
            reason: `Timeout (${input.timeoutSeconds ?? 0}s): ${input.reason}`
          });
          break;
      }
    }
  });
}

export async function createReport(input: {
  reporterUserId: string;
  serverId: string;
  channelId?: string;
  targetUserId?: string;
  targetMessageId?: string;
  reason: string;
}): Promise<ModerationReport> {
  return withDb(async (db) => {
    const id = `rpt_${crypto.randomUUID().replaceAll("-", "")}`;
    const row = await db.query<{
      id: string;
      server_id: string;
      channel_id: string | null;
      reporter_user_id: string;
      target_user_id: string | null;
      target_message_id: string | null;
      reason: string;
      status: ReportStatus;
      triaged_by_user_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `insert into moderation_reports
       (id, server_id, channel_id, reporter_user_id, target_user_id, target_message_id, reason, status)
       values ($1, $2, $3, $4, $5, $6, $7, 'open')
       returning *`,
      [id, input.serverId, input.channelId ?? null, input.reporterUserId, input.targetUserId ?? null, input.targetMessageId ?? null, input.reason]
    );

    const value = row.rows[0]!;
    return {
      id: value.id,
      serverId: value.server_id,
      channelId: value.channel_id,
      reporterUserId: value.reporter_user_id,
      targetUserId: value.target_user_id,
      targetMessageId: value.target_message_id,
      reason: value.reason,
      status: value.status,
      triagedByUserId: value.triaged_by_user_id,
      createdAt: value.created_at,
      updatedAt: value.updated_at
    };
  });
}

export async function transitionReportStatus(input: {
  actorUserId: string;
  reportId: string;
  serverId: string;
  status: Exclude<ReportStatus, "open">;
  reason: string;
}): Promise<ModerationReport> {
  await executePrivilegedAction({
    actorUserId: input.actorUserId,
    action: "reports.triage",
    scope: { serverId: input.serverId },
    reason: input.reason,
    metadata: { reportId: input.reportId, status: input.status },
    run: async () => Promise.resolve()
  });

  return withDb(async (db) => {
    const row = await db.query<{
      id: string;
      server_id: string;
      channel_id: string | null;
      reporter_user_id: string;
      target_user_id: string | null;
      target_message_id: string | null;
      reason: string;
      status: ReportStatus;
      triaged_by_user_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `update moderation_reports
       set status = $1, triaged_by_user_id = $2, updated_at = now()
       where id = $3 and server_id = $4
       returning *`,
      [input.status, input.actorUserId, input.reportId, input.serverId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Report not found for scope.");
    }

    return {
      id: value.id,
      serverId: value.server_id,
      channelId: value.channel_id,
      reporterUserId: value.reporter_user_id,
      targetUserId: value.target_user_id,
      targetMessageId: value.target_message_id,
      reason: value.reason,
      status: value.status,
      triagedByUserId: value.triaged_by_user_id,
      createdAt: value.created_at,
      updatedAt: value.updated_at
    };
  });
}

export async function listReports(input: {
  serverId: string;
  status?: ReportStatus;
}): Promise<ModerationReport[]> {
  return withDb(async (db) => {
    const rows = await db.query<{
      id: string;
      server_id: string;
      channel_id: string | null;
      reporter_user_id: string;
      target_user_id: string | null;
      target_message_id: string | null;
      reason: string;
      status: ReportStatus;
      triaged_by_user_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `select *
       from moderation_reports
       where server_id = $1
         and ($2::text is null or status = $2)
       order by created_at desc
       limit 200`,
      [input.serverId, input.status ?? null]
    );

    return rows.rows.map((value) => ({
      id: value.id,
      serverId: value.server_id,
      channelId: value.channel_id,
      reporterUserId: value.reporter_user_id,
      targetUserId: value.target_user_id,
      targetMessageId: value.target_message_id,
      reason: value.reason,
      status: value.status,
      triagedByUserId: value.triaged_by_user_id,
      createdAt: value.created_at,
      updatedAt: value.updated_at
    }));
  });
}

export async function listAuditLogs(serverId: string): Promise<ModerationAction[]> {
  return withDb(async (db) => {
    const rows = await db.query<{
      id: string;
      action_type: ModerationAction["actionType"];
      actor_user_id: string;
      server_id: string;
      channel_id: string | null;
      target_user_id: string | null;
      target_message_id: string | null;
      reason: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }>(
      "select * from moderation_actions where server_id = $1 order by created_at desc limit 200",
      [serverId]
    );

    return rows.rows.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      actorUserId: row.actor_user_id,
      serverId: row.server_id,
      channelId: row.channel_id,
      targetUserId: row.target_user_id,
      targetMessageId: row.target_message_id,
      reason: row.reason,
      metadata: row.metadata ?? {},
      createdAt: row.created_at
    }));
  });
}
