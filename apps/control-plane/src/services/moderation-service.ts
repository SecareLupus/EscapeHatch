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
    run: async () => Promise.resolve()
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
