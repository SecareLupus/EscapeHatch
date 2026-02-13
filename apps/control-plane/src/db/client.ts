import { Pool } from "pg";
import { config } from "../config.js";

export const pool = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl })
  : null;

export async function withDb<T>(fn: (db: Pool) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error("DATABASE_URL must be configured for persistence-backed APIs.");
  }

  return fn(pool);
}

export async function initDb(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.query(`
    create table if not exists identity_mappings (
      id text primary key,
      provider text not null,
      oidc_subject text not null,
      email text,
      preferred_username text,
      avatar_url text,
      matrix_user_id text,
      product_user_id text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(provider, oidc_subject)
    );

    create table if not exists hubs (
      id text primary key,
      name text not null,
      owner_user_id text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists servers (
      id text primary key,
      hub_id text not null references hubs(id),
      name text not null,
      matrix_space_id text,
      created_by_user_id text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists categories (
      id text primary key,
      server_id text not null references servers(id),
      name text not null,
      matrix_subspace_id text,
      created_at timestamptz not null default now()
    );

    create table if not exists channels (
      id text primary key,
      server_id text not null references servers(id),
      category_id text references categories(id),
      name text not null,
      type text not null,
      matrix_room_id text,
      is_locked boolean not null default false,
      slow_mode_seconds integer not null default 0,
      posting_restricted_to_roles text[] not null default '{}',
      voice_sfu_room_id text,
      voice_max_participants integer,
      created_at timestamptz not null default now()
    );

    create table if not exists idempotency_keys (
      idempotency_key text primary key,
      request_hash text not null,
      response_json jsonb not null,
      created_at timestamptz not null default now()
    );

    create table if not exists role_bindings (
      id text primary key,
      product_user_id text not null,
      role text not null,
      hub_id text,
      server_id text,
      channel_id text,
      created_at timestamptz not null default now()
    );

    create table if not exists moderation_actions (
      id text primary key,
      action_type text not null,
      actor_user_id text not null,
      server_id text not null,
      channel_id text,
      target_user_id text,
      target_message_id text,
      reason text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists moderation_reports (
      id text primary key,
      server_id text not null,
      channel_id text,
      reporter_user_id text not null,
      target_user_id text,
      target_message_id text,
      reason text not null,
      status text not null,
      triaged_by_user_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table channels add column if not exists is_locked boolean not null default false;
    alter table channels add column if not exists slow_mode_seconds integer not null default 0;
    alter table channels add column if not exists posting_restricted_to_roles text[] not null default '{}';
    alter table channels add column if not exists voice_sfu_room_id text;
    alter table channels add column if not exists voice_max_participants integer;
  `);
}
