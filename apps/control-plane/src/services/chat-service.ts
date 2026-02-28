import crypto from "node:crypto";
import type { Category, Channel, ChannelReadState, ChatMessage, MentionMarker, Server } from "@escapehatch/shared";
import { withDb } from "../db/client.js";

interface ChannelRow {
  id: string;
  server_id: string;
  category_id: string | null;
  name: string;
  type: Channel["type"];
  matrix_room_id: string | null;
  is_locked: boolean;
  slow_mode_seconds: number;
  posting_restricted_to_roles: string[] | null;
  voice_sfu_room_id: string | null;
  voice_max_participants: number | null;
  video_enabled: boolean;
  video_max_participants: number | null;
  position: number;
  created_at: string;
}

interface CategoryRow {
  id: string;
  server_id: string;
  name: string;
  matrix_subspace_id: string | null;
  position: number;
  created_at: string;
}

function mapChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    serverId: row.server_id,
    categoryId: row.category_id,
    name: row.name,
    type: row.type,
    matrixRoomId: row.matrix_room_id,
    isLocked: row.is_locked,
    slowModeSeconds: row.slow_mode_seconds,
    postingRestrictedToRoles: (row.posting_restricted_to_roles ?? []) as Channel["postingRestrictedToRoles"],
    voiceMetadata:
      row.voice_sfu_room_id && row.voice_max_participants
        ? {
          sfuRoomId: row.voice_sfu_room_id,
          maxParticipants: row.voice_max_participants,
          videoEnabled: row.video_enabled,
          maxVideoParticipants: row.video_max_participants
        }
        : null,
    position: row.position,
    createdAt: row.created_at
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    matrixSubspaceId: row.matrix_subspace_id,
    position: row.position,
    createdAt: row.created_at
  };
}

export async function listServers(): Promise<Server[]> {
  return withDb(async (db) => {
    const rows = await db.query<{
      id: string;
      hub_id: string;
      name: string;
      matrix_space_id: string | null;
      created_by_user_id: string;
      owner_user_id: string;
      created_at: string;
    }>("select * from servers order by created_at asc");

    return rows.rows.map((row) => ({
      id: row.id,
      hubId: row.hub_id,
      name: row.name,
      matrixSpaceId: row.matrix_space_id,
      createdByUserId: row.created_by_user_id,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at
    }));
  });
}

export async function listChannels(serverId: string): Promise<Channel[]> {
  return withDb(async (db) => {
    const rows = await db.query<ChannelRow>(
      "select * from channels where server_id = $1 order by position asc, created_at asc",
      [serverId]
    );
    return rows.rows.map(mapChannel);
  });
}

export async function listCategories(serverId: string): Promise<Category[]> {
  return withDb(async (db) => {
    const rows = await db.query<CategoryRow>(
      "select * from categories where server_id = $1 order by position asc, created_at asc",
      [serverId]
    );
    return rows.rows.map(mapCategory);
  });
}

export async function listMessages(input: {
  channelId: string;
  limit: number;
  before?: string;
}): Promise<ChatMessage[]> {
  return withDb(async (db) => {
    if (input.before) {
      const rows = await db.query<{
        id: string;
        channel_id: string;
        author_user_id: string;
        author_display_name: string;
        content: string;
        created_at: string;
      }>(
        `select * from chat_messages
         where channel_id = $1 and created_at < $2::timestamptz
         order by created_at desc
         limit $3`,
        [input.channelId, input.before, input.limit]
      );

      return rows.rows.reverse().map((row) => ({
        id: row.id,
        channelId: row.channel_id,
        authorUserId: row.author_user_id,
        authorDisplayName: row.author_display_name,
        content: row.content,
        createdAt: row.created_at
      }));
    }

    const rows = await db.query<{
      id: string;
      channel_id: string;
      author_user_id: string;
      author_display_name: string;
      content: string;
      created_at: string;
    }>(
      `select * from chat_messages
       where channel_id = $1
       order by created_at desc
       limit $2`,
      [input.channelId, input.limit]
    );

    return rows.rows.reverse().map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      authorUserId: row.author_user_id,
      authorDisplayName: row.author_display_name,
      content: row.content,
      createdAt: row.created_at
    }));
  });
}

export async function createMessage(input: {
  channelId: string;
  actorUserId: string;
  content: string;
  isRelay?: boolean;
}): Promise<ChatMessage> {
  return withDb(async (db) => {
    try {
      const identity = await db.query<{ preferred_username: string | null; email: string | null }>(
        `select preferred_username, email
       from identity_mappings
       where product_user_id = $1
       order by (preferred_username is not null) desc, updated_at desc, created_at asc
       limit 1`,
        [input.actorUserId]
      );

      const profile = identity.rows[0];
      const fallbackName = profile?.email?.split("@")[0] ?? `user-${input.actorUserId.slice(0, 8)}`;
      const authorDisplayName = profile?.preferred_username ?? fallbackName;

      // Outbound Discord Relay Logic
      if (!input.isRelay) {
        try {
          const { listDiscordChannelMappings } = await import("./discord-bridge-service.js");
          const { relayMatrixMessageToDiscord } = await import("./discord-bot-client.js");

          // We need to find which server this channel belongs to
          const channelRow = await db.query<{ server_id: string }>(
            "select server_id from channels where id = $1 limit 1",
            [input.channelId]
          );
          const serverId = channelRow.rows[0]?.server_id;

          if (serverId) {
            const mappings = await listDiscordChannelMappings(serverId);
            const mappedChannels = mappings.filter(m => m.matrixChannelId === input.channelId && m.enabled);
            for (const m of mappedChannels) {
              await relayMatrixMessageToDiscord({
                serverId,
                discordChannelId: m.discordChannelId,
                authorName: authorDisplayName,
                content: input.content
              });
            }
          }
        } catch (error) {
          // Don't block message creation if relay fails
          console.error("Failed to relay message to Discord:", error);
        }
      }

      const created = await db.query<{
        id: string;
        channel_id: string;
        author_user_id: string;
        author_display_name: string;
        content: string;
        created_at: string;
      }>(
        `insert into chat_messages (id, channel_id, author_user_id, author_display_name, content)
       values ($1, $2, $3, $4, $5)
       returning *`,
        [`msg_${crypto.randomUUID().replaceAll("-", "")}`, input.channelId, input.actorUserId, authorDisplayName, input.content]
      );

      const row = created.rows[0];
      if (!row) {
        throw new Error("Message was not created.");
      }

      const message = {
        id: row.id,
        channelId: row.channel_id,
        authorUserId: row.author_user_id,
        authorDisplayName: row.author_display_name,
        content: row.content,
        createdAt: row.created_at
      };

      const mentionHandles = [...new Set((input.content.match(/@([a-zA-Z0-9._-]{3,40})/g) ?? []).map((token) => token.slice(1).toLowerCase()))];
      if (mentionHandles.length > 0) {
        const mentionRows = await db.query<{ product_user_id: string }>(
          `select distinct product_user_id
         from identity_mappings
         where lower(preferred_username) = any($1::text[])`,
          [mentionHandles]
        );

        for (const mentioned of mentionRows.rows) {
          if (!mentioned.product_user_id || mentioned.product_user_id === input.actorUserId) {
            continue;
          }

          await db.query(
            `insert into mention_markers (id, channel_id, message_id, mentioned_user_id)
           values ($1, $2, $3, $4)`,
            [
              `mm_${crypto.randomUUID().replaceAll("-", "")}`,
              input.channelId,
              message.id,
              mentioned.product_user_id
            ]
          );
        }
      }
      return message;
    } catch (e) {
      console.error("CREATE_MESSAGE_ERROR", e);
      throw e;
    }
  });
}

export async function listChannelReadStates(input: {
  productUserId: string;
  serverId: string;
}): Promise<ChannelReadState[]> {
  return withDb(async (db) => {
    const rows = await db.query<{
      channel_id: string;
      product_user_id: string;
      last_read_at: string;
      updated_at: string;
    }>(
      `select rs.channel_id, rs.product_user_id, rs.last_read_at, rs.updated_at
       from channel_read_states rs
       join channels ch on ch.id = rs.channel_id
       where rs.product_user_id = $1 and ch.server_id = $2
       order by rs.updated_at desc`,
      [input.productUserId, input.serverId]
    );

    return rows.rows.map((row) => ({
      channelId: row.channel_id,
      userId: row.product_user_id,
      lastReadAt: row.last_read_at,
      updatedAt: row.updated_at
    }));
  });
}

export async function upsertChannelReadState(input: {
  productUserId: string;
  channelId: string;
  at?: string;
}): Promise<ChannelReadState> {
  return withDb(async (db) => {
    const rows = await db.query<{
      channel_id: string;
      product_user_id: string;
      last_read_at: string;
      updated_at: string;
    }>(
      `insert into channel_read_states (product_user_id, channel_id, last_read_at)
       values ($1, $2, coalesce($3::timestamptz, now()))
       on conflict (product_user_id, channel_id)
       do update set last_read_at = excluded.last_read_at, updated_at = now()
       returning channel_id, product_user_id, last_read_at, updated_at`,
      [input.productUserId, input.channelId, input.at ?? null]
    );

    const row = rows.rows[0];
    if (!row) {
      throw new Error("Read state was not updated.");
    }

    return {
      channelId: row.channel_id,
      userId: row.product_user_id,
      lastReadAt: row.last_read_at,
      updatedAt: row.updated_at
    };
  });
}

export async function listMentionMarkers(input: {
  productUserId: string;
  channelId?: string;
  serverId?: string;
  limit?: number;
}): Promise<MentionMarker[]> {
  return withDb(async (db) => {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 300);
    const rows = await db.query<{
      id: string;
      channel_id: string;
      message_id: string;
      mentioned_user_id: string;
      created_at: string;
    }>(
      `select mm.id, mm.channel_id, mm.message_id, mm.mentioned_user_id, mm.created_at
       from mention_markers mm
       join channels ch on ch.id = mm.channel_id
       left join channel_read_states rs
         on rs.channel_id = mm.channel_id
        and rs.product_user_id = mm.mentioned_user_id
       where mm.mentioned_user_id = $1
         and ($2::text is null or mm.channel_id = $2)
         and ($3::text is null or ch.server_id = $3)
         and (rs.last_read_at is null or mm.created_at > rs.last_read_at)
       order by mm.created_at desc
       limit $4`,
      [input.productUserId, input.channelId ?? null, input.serverId ?? null, limit]
    );

    return rows.rows.map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      messageId: row.message_id,
      mentionedUserId: row.mentioned_user_id,
      createdAt: row.created_at
    }));
  });
}

export async function createCategory(input: {
  serverId: string;
  name: string;
}): Promise<Category> {
  return withDb(async (db) => {
    const row = await db.query<CategoryRow>(
      `insert into categories (id, server_id, name, matrix_subspace_id)
       values ($1, $2, $3, null)
       returning *`,
      [`cat_${crypto.randomUUID().replaceAll("-", "")}`, input.serverId, input.name]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Category was not created.");
    }

    return mapCategory(value);
  });
}

export async function updateCategory(input: {
  categoryId: string;
  serverId: string;
  name?: string;
  position?: number;
}): Promise<Category> {
  return withDb(async (db) => {
    const row = await db.query<CategoryRow>(
      `update categories
       set name = coalesce($1, name),
           position = coalesce($2, position)
       where id = $3 and server_id = $4
       returning *`,
      [input.name ?? null, input.position ?? null, input.categoryId, input.serverId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Category not found.");
    }

    return mapCategory(value);
  });
}

export async function renameCategory(input: {
  categoryId: string;
  serverId: string;
  name: string;
}): Promise<Category> {
  return updateCategory(input);
}

export async function deleteCategory(input: { categoryId: string; serverId: string }): Promise<void> {
  await withDb(async (db) => {
    await db.query("begin");
    try {
      // First, move all channels in this category to null category (uncategorized)
      await db.query(
        "update channels set category_id = null where category_id = $1 and server_id = $2",
        [input.categoryId, input.serverId]
      );

      const deleted = await db.query(
        "delete from categories where id = $1 and server_id = $2 returning id",
        [input.categoryId, input.serverId]
      );

      if (deleted.rowCount === 0) {
        throw new Error("Category not found.");
      }

      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}

export async function updateChannel(input: {
  channelId: string;
  serverId: string;
  name?: string;
  type?: Channel["type"];
  categoryId?: string | null;
  position?: number;
}): Promise<Channel> {
  return withDb(async (db) => {
    if (input.categoryId) {
      const category = await db.query<{ id: string }>(
        "select id from categories where id = $1 and server_id = $2 limit 1",
        [input.categoryId, input.serverId]
      );
      if (!category.rows[0]) {
        throw new Error("Category not found for server.");
      }
    }

    const row = await db.query<ChannelRow>(
      `update channels
       set name = coalesce($1, name),
           type = coalesce($2, type),
           category_id = case when $3 = 'REMOVED_VAL' then null else coalesce($4, category_id) end,
           position = coalesce($5, position)
       where id = $6 and server_id = $7
       returning *`,
      [
        input.name ?? null,
        input.type ?? null,
        input.categoryId === null ? "REMOVED_VAL" : "NORMAL",
        input.categoryId ?? null,
        input.position ?? null,
        input.channelId,
        input.serverId
      ]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Channel not found.");
    }

    return mapChannel(value);
  });
}

export async function moveChannelToCategory(input: {
  channelId: string;
  serverId: string;
  categoryId: string | null;
}): Promise<Channel> {
  return updateChannel(input);
}

export async function renameServer(input: { serverId: string; name: string }): Promise<Server> {
  return withDb(async (db) => {
    const row = await db.query<{
      id: string;
      hub_id: string;
      name: string;
      matrix_space_id: string | null;
      created_by_user_id: string;
      owner_user_id: string;
      created_at: string;
    }>(
      `update servers
       set name = $1
       where id = $2
       returning *`,
      [input.name, input.serverId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Server not found.");
    }

    return {
      id: value.id,
      hubId: value.hub_id,
      name: value.name,
      matrixSpaceId: value.matrix_space_id,
      createdByUserId: value.created_by_user_id,
      ownerUserId: value.owner_user_id,
      createdAt: value.created_at
    };
  });
}

export async function deleteServer(serverId: string): Promise<void> {
  await withDb(async (db) => {
    await db.query("begin");
    try {
      const channelIds = await db.query<{ id: string }>(
        "select id from channels where server_id = $1",
        [serverId]
      );
      const ids = channelIds.rows.map((row) => row.id);

      if (ids.length > 0) {
        await db.query("delete from role_bindings where channel_id = any($1::text[])", [ids]);
        await db.query("delete from chat_messages where channel_id = any($1::text[])", [ids]);
      }

      await db.query("delete from role_bindings where server_id = $1", [serverId]);
      await db.query("delete from channels where server_id = $1", [serverId]);
      await db.query("delete from categories where server_id = $1", [serverId]);

      const deleted = await db.query("delete from servers where id = $1 returning id", [serverId]);
      if (deleted.rowCount === 0) {
        throw new Error("Server not found.");
      }

      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}

export async function renameChannel(input: {
  channelId: string;
  serverId: string;
  name: string;
}): Promise<Channel> {
  return updateChannel(input);
}

export async function updateChannelVideoControls(input: {
  channelId: string;
  serverId: string;
  videoEnabled: boolean;
  maxVideoParticipants?: number;
}): Promise<Channel> {
  return withDb(async (db) => {
    const row = await db.query<ChannelRow>(
      `update channels
       set video_enabled = $3,
           video_max_participants = $4
       where id = $1 and server_id = $2 and type = 'voice'
       returning *`,
      [input.channelId, input.serverId, input.videoEnabled, input.maxVideoParticipants ?? null]
    );

    const updated = row.rows[0];
    if (!updated) {
      throw new Error("Voice channel not found.");
    }
    return mapChannel(updated);
  });
}

export async function deleteChannel(input: { channelId: string; serverId: string }): Promise<void> {
  await withDb(async (db) => {
    await db.query("begin");
    try {
      await db.query("delete from role_bindings where channel_id = $1", [input.channelId]);
      await db.query("delete from chat_messages where channel_id = $1", [input.channelId]);
      const deleted = await db.query(
        "delete from channels where id = $1 and server_id = $2 returning id",
        [input.channelId, input.serverId]
      );

      if (deleted.rowCount === 0) {
        throw new Error("Channel not found.");
      }

      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}

export async function getUnreadSummary(productUserId: string): Promise<Record<string, { unreadCount: number; mentionCount: number }>> {
  return withDb(async (db) => {
    // 1. Get unread message counts per channel
    // Joined with channel_read_states to compare message creation time with last read time.
    const messageCounts = await db.query<{ channel_id: string; unread_count: number }>(
      `select ch.id as channel_id, 
              (case when coalesce(rs.is_muted, false) then 0 else count(msg.id) end) as unread_count
       from channels ch
       join chat_messages msg on msg.channel_id = ch.id
       left join channel_read_states rs on rs.channel_id = ch.id and rs.product_user_id = $1
       where msg.author_user_id != $1 and (rs.last_read_at is null or msg.created_at > rs.last_read_at)
       group by ch.id, rs.is_muted`,
      [productUserId]
    );

    // 2. Get unread mention counts per channel
    // Uses the same logic: mentions created after the last read timestamp.
    const mentionCounts = await db.query<{ channel_id: string; mention_count: number }>(
      `select mm.channel_id, count(mm.id) as mention_count
       from mention_markers mm
       left join channel_read_states rs on rs.channel_id = mm.channel_id and rs.product_user_id = $1
       where mm.mentioned_user_id = $1
         and (rs.last_read_at is null or mm.created_at > rs.last_read_at)
       group by mm.channel_id`,
      [productUserId]
    );

    const summary: Record<string, { unreadCount: number; mentionCount: number; isMuted: boolean }> = {};
    const mutedStatusRows = await db.query<{ channel_id: string; is_muted: boolean }>(
      "select channel_id, is_muted from channel_read_states where product_user_id = $1",
      [productUserId]
    );
    const muteMap: Record<string, boolean> = {};
    for (const row of mutedStatusRows.rows) {
      muteMap[row.channel_id] = row.is_muted;
    }

    for (const row of messageCounts.rows) {
      summary[row.channel_id] = {
        unreadCount: Number(row.unread_count),
        mentionCount: 0,
        isMuted: muteMap[row.channel_id] ?? false
      };
    }

    for (const row of mentionCounts.rows) {
      if (!summary[row.channel_id]) {
        summary[row.channel_id] = {
          unreadCount: 0,
          mentionCount: 0,
          isMuted: muteMap[row.channel_id] ?? false
        };
      }
      summary[row.channel_id]!.mentionCount = Number(row.mention_count);
    }

    return summary;
  });
}
