import crypto from "node:crypto";
import type { ModerationActionType } from "@escapehatch/shared";
import { withDb } from "../db/client.js";
import { isActionAllowed, type PrivilegedAction } from "./policy-service.js";

function toModerationActionType(action: PrivilegedAction): ModerationActionType {
  if (action === "moderation.kick") return "kick";
  if (action === "moderation.ban") return "ban";
  if (action === "moderation.unban") return "unban";
  if (action === "moderation.timeout") return "timeout";
  if (action === "moderation.redact") return "redact_message";
  if (action === "channel.lock") return "lock_channel";
  if (action === "channel.unlock") return "unlock_channel";
  if (action === "channel.slowmode") return "set_slow_mode";
  return "set_posting_restrictions";
}

export async function executePrivilegedAction<T>(input: {
  actorUserId: string;
  action: PrivilegedAction;
  scope: { hubId?: string; serverId: string; channelId?: string };
  reason: string;
  targetUserId?: string;
  targetMessageId?: string;
  metadata?: Record<string, unknown>;
  run: () => Promise<T>;
}): Promise<T> {
  const allowed = await isActionAllowed({
    productUserId: input.actorUserId,
    action: input.action,
    scope: input.scope
  });

  if (!allowed) {
    throw new Error("Forbidden: action is outside of assigned moderation scope.");
  }

  const result = await input.run();

  await withDb(async (db) => {
    await db.query(
      `insert into moderation_actions
       (id, action_type, actor_user_id, server_id, channel_id, target_user_id, target_message_id, reason, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        `mod_${crypto.randomUUID().replaceAll("-", "")}`,
        toModerationActionType(input.action),
        input.actorUserId,
        input.scope.serverId,
        input.scope.channelId ?? null,
        input.targetUserId ?? null,
        input.targetMessageId ?? null,
        input.reason,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  });

  return result;
}
