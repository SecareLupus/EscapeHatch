import crypto from "node:crypto";
import type { Channel, ChannelType, Server } from "@escapehatch/shared";
import { withDb } from "../db/client.js";
import { attachChildRoom, createChannelRoom, createSpace } from "../matrix/synapse-adapter.js";
import { withRetry } from "./retry.js";

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function hashRequest(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function checkIdempotency<T>(
  idempotencyKey: string | undefined,
  payload: unknown
): Promise<T | null> {
  if (!idempotencyKey) {
    return null;
  }

  return withDb(async (db) => {
    const requestHash = hashRequest(payload);
    const row = await db.query<{ request_hash: string; response_json: T }>(
      "select request_hash, response_json from idempotency_keys where idempotency_key = $1 limit 1",
      [idempotencyKey]
    );

    const existing = row.rows[0];
    if (!existing) {
      return null;
    }

    if (existing.request_hash !== requestHash) {
      throw new Error("Idempotency key reuse with different payload is not allowed.");
    }

    return existing.response_json;
  });
}

async function storeIdempotency<T>(idempotencyKey: string | undefined, payload: unknown, response: T): Promise<void> {
  if (!idempotencyKey) {
    return;
  }

  await withDb(async (db) => {
    await db.query(
      "insert into idempotency_keys (idempotency_key, request_hash, response_json) values ($1, $2, $3) on conflict (idempotency_key) do nothing",
      [idempotencyKey, hashRequest(payload), JSON.stringify(response)]
    );
  });
}

export async function createServerWorkflow(input: {
  hubId: string;
  name: string;
  productUserId: string;
  idempotencyKey?: string;
}): Promise<Server> {
  const cached = await checkIdempotency<Server>(input.idempotencyKey, input);
  if (cached) {
    return cached;
  }

  const matrixSpaceId = await withRetry(() => createSpace({ name: input.name }));

  const server = await withDb(async (db) => {
    const id = randomId("srv");
    const row = await db.query<{
      id: string;
      hub_id: string;
      name: string;
      matrix_space_id: string | null;
      created_by_user_id: string;
      created_at: string;
    }>(
      `insert into servers (id, hub_id, name, matrix_space_id, created_by_user_id)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [id, input.hubId, input.name, matrixSpaceId, input.productUserId]
    );

    const value = row.rows[0];
    if (!value) {
      throw new Error("Server creation failed.");
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

  await storeIdempotency(input.idempotencyKey, input, server);
  return server;
}

export async function createChannelWorkflow(input: {
  serverId: string;
  categoryId?: string;
  name: string;
  type: ChannelType;
  idempotencyKey?: string;
}): Promise<Channel> {
  const cached = await checkIdempotency<Channel>(input.idempotencyKey, input);
  if (cached) {
    return cached;
  }

  const matrixRoomId = await withRetry(() => createChannelRoom({ name: input.name, type: input.type }));

  const channel = await withDb(async (db) => {
    const row = await db.query<{ matrix_space_id: string | null }>(
      "select matrix_space_id from servers where id = $1 limit 1",
      [input.serverId]
    );

    const server = row.rows[0];
    if (!server) {
      throw new Error("Server not found.");
    }

    const id = randomId("chn");
    const voiceRoomId = input.type === "voice" ? `sfu_${id}` : null;
    const created = await db.query<{
      id: string;
      server_id: string;
      category_id: string | null;
      name: string;
      type: ChannelType;
      matrix_room_id: string | null;
      is_locked: boolean;
      slow_mode_seconds: number;
      posting_restricted_to_roles: string[];
      voice_sfu_room_id: string | null;
      voice_max_participants: number | null;
      created_at: string;
    }>(
      `insert into channels (id, server_id, category_id, name, type, matrix_room_id, voice_sfu_room_id, voice_max_participants)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [id, input.serverId, input.categoryId ?? null, input.name, input.type, matrixRoomId, voiceRoomId, input.type === "voice" ? 25 : null]
    );

    const value = created.rows[0];
    if (!value) {
      throw new Error("Channel creation failed.");
    }

    const matrixSpaceId = server.matrix_space_id;
    if (matrixSpaceId && matrixRoomId) {
      await withRetry(() => attachChildRoom(matrixSpaceId, matrixRoomId));
    }

    return {
      id: value.id,
      serverId: value.server_id,
      categoryId: value.category_id,
      name: value.name,
      type: value.type,
      matrixRoomId: value.matrix_room_id,
      isLocked: value.is_locked,
      slowModeSeconds: value.slow_mode_seconds,
      postingRestrictedToRoles: (value.posting_restricted_to_roles ?? []) as Channel["postingRestrictedToRoles"],
      voiceMetadata:
        value.voice_sfu_room_id && value.voice_max_participants
          ? {
              sfuRoomId: value.voice_sfu_room_id,
              maxParticipants: value.voice_max_participants
            }
          : null,
      createdAt: value.created_at
    };
  });

  await storeIdempotency(input.idempotencyKey, input, channel);
  return channel;
}
