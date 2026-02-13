import type { VoicePresenceMember } from "@escapehatch/shared";
import { withDb } from "../db/client.js";
import { isActionAllowed } from "./policy-service.js";

async function ensureVoiceJoinAllowed(input: {
  productUserId: string;
  serverId: string;
  channelId: string;
}): Promise<void> {
  const allowed = await isActionAllowed({
    productUserId: input.productUserId,
    action: "voice.token.issue",
    scope: { serverId: input.serverId, channelId: input.channelId }
  });
  if (!allowed) {
    const error = new Error("Forbidden: voice join is outside assigned scope.") as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 403;
    error.code = "forbidden_scope";
    throw error;
  }
}

export async function joinVoicePresence(input: {
  productUserId: string;
  serverId: string;
  channelId: string;
  muted?: boolean;
  deafened?: boolean;
}): Promise<void> {
  await ensureVoiceJoinAllowed(input);
  await withDb(async (db) => {
    await db.query(
      `insert into voice_presence (channel_id, product_user_id, muted, deafened, joined_at, updated_at)
       values ($1, $2, $3, $4, now(), now())
       on conflict (channel_id, product_user_id)
       do update set muted = excluded.muted, deafened = excluded.deafened, updated_at = now()`,
      [input.channelId, input.productUserId, input.muted ?? false, input.deafened ?? false]
    );
  });
}

export async function updateVoicePresenceState(input: {
  productUserId: string;
  serverId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
}): Promise<void> {
  await ensureVoiceJoinAllowed(input);
  await withDb(async (db) => {
    await db.query(
      `update voice_presence
       set muted = $1, deafened = $2, updated_at = now()
       where channel_id = $3 and product_user_id = $4`,
      [input.muted, input.deafened, input.channelId, input.productUserId]
    );
  });
}

export async function leaveVoicePresence(input: {
  productUserId: string;
  serverId: string;
  channelId: string;
}): Promise<void> {
  await ensureVoiceJoinAllowed(input);
  await withDb(async (db) => {
    await db.query("delete from voice_presence where channel_id = $1 and product_user_id = $2", [
      input.channelId,
      input.productUserId
    ]);
  });
}

export async function listVoicePresence(input: { channelId: string; serverId: string }): Promise<VoicePresenceMember[]> {
  return withDb(async (db) => {
    const rows = await db.query<{
      channel_id: string;
      product_user_id: string;
      muted: boolean;
      deafened: boolean;
      joined_at: string;
      updated_at: string;
      preferred_username: string | null;
      email: string | null;
      channel_server_id: string;
    }>(
      `select
         vp.channel_id,
         vp.product_user_id,
         vp.muted,
         vp.deafened,
         vp.joined_at,
         vp.updated_at,
         profile.preferred_username,
         profile.email,
         ch.server_id as channel_server_id
       from voice_presence vp
       join channels ch on ch.id = vp.channel_id
       left join lateral (
         select im.preferred_username, im.email
         from identity_mappings im
         where im.product_user_id = vp.product_user_id
         order by (im.preferred_username is not null) desc, im.updated_at desc, im.created_at asc
         limit 1
       ) profile on true
       where vp.channel_id = $1
         and ch.server_id = $2
       order by vp.joined_at asc`,
      [input.channelId, input.serverId]
    );

    return rows.rows.map((row) => ({
      channelId: row.channel_id,
      serverId: row.channel_server_id,
      userId: row.product_user_id,
      displayName: row.preferred_username ?? row.email ?? `user-${row.product_user_id.slice(0, 8)}`,
      muted: row.muted,
      deafened: row.deafened,
      joinedAt: row.joined_at,
      updatedAt: row.updated_at
    }));
  });
}
