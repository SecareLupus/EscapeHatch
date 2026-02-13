import crypto from "node:crypto";
import type { Category, Channel, ChatMessage, Server } from "@escapehatch/shared";
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
  created_at: string;
}

interface CategoryRow {
  id: string;
  server_id: string;
  name: string;
  matrix_subspace_id: string | null;
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
            maxParticipants: row.voice_max_participants
          }
        : null,
    createdAt: row.created_at
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    matrixSubspaceId: row.matrix_subspace_id,
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
      created_at: string;
    }>("select * from servers order by created_at asc");

    return rows.rows.map((row) => ({
      id: row.id,
      hubId: row.hub_id,
      name: row.name,
      matrixSpaceId: row.matrix_space_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at
    }));
  });
}

export async function listChannels(serverId: string): Promise<Channel[]> {
  return withDb(async (db) => {
    const rows = await db.query<ChannelRow>(
      "select * from channels where server_id = $1 order by created_at asc",
      [serverId]
    );
    return rows.rows.map(mapChannel);
  });
}

export async function listCategories(serverId: string): Promise<Category[]> {
  return withDb(async (db) => {
    const rows = await db.query<CategoryRow>(
      "select * from categories where server_id = $1 order by created_at asc",
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
}): Promise<ChatMessage> {
  return withDb(async (db) => {
    const identity = await db.query<{ preferred_username: string | null; email: string | null }>(
      "select preferred_username, email from identity_mappings where product_user_id = $1 order by created_at asc limit 1",
      [input.actorUserId]
    );

    const profile = identity.rows[0];
    const fallbackName = profile?.email?.split("@")[0] ?? `user-${input.actorUserId.slice(0, 8)}`;
    const authorDisplayName = profile?.preferred_username ?? fallbackName;

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

    return {
      id: row.id,
      channelId: row.channel_id,
      authorUserId: row.author_user_id,
      authorDisplayName: row.author_display_name,
      content: row.content,
      createdAt: row.created_at
    };
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

export async function renameCategory(input: {
  categoryId: string;
  serverId: string;
  name: string;
}): Promise<Category> {
  return withDb(async (db) => {
    const row = await db.query<CategoryRow>(
      `update categories
       set name = $1
       where id = $2 and server_id = $3
       returning *`,
      [input.name, input.categoryId, input.serverId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Category not found.");
    }

    return mapCategory(value);
  });
}

export async function moveChannelToCategory(input: {
  channelId: string;
  serverId: string;
  categoryId: string | null;
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
       set category_id = $1
       where id = $2 and server_id = $3
       returning *`,
      [input.categoryId, input.channelId, input.serverId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Channel not found.");
    }

    return mapChannel(value);
  });
}

export async function renameServer(input: { serverId: string; name: string }): Promise<Server> {
  return withDb(async (db) => {
    const row = await db.query<{
      id: string;
      hub_id: string;
      name: string;
      matrix_space_id: string | null;
      created_by_user_id: string;
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
  return withDb(async (db) => {
    const row = await db.query<ChannelRow>(
      `update channels
       set name = $1
       where id = $2 and server_id = $3
       returning *`,
      [input.name, input.channelId, input.serverId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Channel not found.");
    }

    return mapChannel(value);
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
