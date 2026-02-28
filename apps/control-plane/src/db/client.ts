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
      theme text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(provider, oidc_subject)
    );

    create table if not exists hubs (
      id text primary key,
      name text not null,
      owner_user_id text not null,
      s3_config jsonb,
      allow_space_discord_bridge boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists servers (
      id text primary key,
      hub_id text not null references hubs(id),
      name text not null,
      matrix_space_id text,
      created_by_user_id text not null,
      owner_user_id text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists categories (
      id text primary key,
      server_id text not null references servers(id),
      name text not null,
      matrix_subspace_id text,
      position integer not null default 0,
      created_at timestamptz not null default now()
    );

    create table if not exists channels (
      id text primary key,
      server_id text not null references servers(id),
      category_id text references categories(id),
      name text not null,
      type text not null,
      matrix_room_id text,
      position integer not null default 0,
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

    create table if not exists role_assignment_audit_logs (
      id text primary key,
      actor_user_id text not null,
      target_user_id text not null,
      role text not null,
      hub_id text,
      server_id text,
      channel_id text,
      outcome text not null,
      reason text,
      created_at timestamptz not null default now()
    );

    create table if not exists space_admin_assignments (
      id text primary key,
      hub_id text not null references hubs(id) on delete cascade,
      server_id text not null references servers(id) on delete cascade,
      assigned_user_id text not null,
      assigned_by_user_id text not null,
      status text not null default 'active',
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(server_id, assigned_user_id)
    );

    create table if not exists delegation_audit_events (
      id text primary key,
      action_type text not null,
      actor_user_id text not null,
      target_user_id text,
      assignment_id text references space_admin_assignments(id) on delete set null,
      hub_id text references hubs(id) on delete set null,
      server_id text references servers(id) on delete set null,
      metadata jsonb not null default '{}'::jsonb,
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

    create table if not exists chat_messages (
      id text primary key,
      channel_id text not null references channels(id) on delete cascade,
      author_user_id text not null,
      author_display_name text not null,
      content text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists channel_read_states (
      product_user_id text not null,
      channel_id text not null references channels(id) on delete cascade,
      last_read_at timestamptz not null,
      is_muted boolean not null default false,
      updated_at timestamptz not null default now(),
      primary key (product_user_id, channel_id)
    );

    create table if not exists mention_markers (
      id text primary key,
      channel_id text not null references channels(id) on delete cascade,
      message_id text not null references chat_messages(id) on delete cascade,
      mentioned_user_id text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists voice_presence (
      channel_id text not null references channels(id) on delete cascade,
      product_user_id text not null,
      muted boolean not null default false,
      deafened boolean not null default false,
      video_enabled boolean not null default false,
      video_quality text not null default 'medium',
      joined_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (channel_id, product_user_id)
    );

    create table if not exists hub_federation_policies (
      hub_id text primary key references hubs(id) on delete cascade,
      allowlist text[] not null default '{}',
      created_by_user_id text not null,
      updated_by_user_id text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists federation_policy_events (
      id text primary key,
      hub_id text not null references hubs(id) on delete cascade,
      actor_user_id text not null,
      action_type text not null,
      policy_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists room_acl_status (
      room_id text primary key,
      hub_id text not null references hubs(id) on delete cascade,
      server_id text references servers(id) on delete cascade,
      channel_id text references channels(id) on delete cascade,
      room_kind text not null,
      allowlist text[] not null default '{}',
      status text not null,
      last_error text,
      applied_at timestamptz,
      checked_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists discord_bridge_connections (
      id text primary key,
      server_id text not null unique references servers(id) on delete cascade,
      connected_by_user_id text not null,
      discord_user_id text,
      discord_username text,
      access_token text,
      refresh_token text,
      token_expires_at timestamptz,
      guild_id text,
      guild_name text,
      status text not null default 'disconnected',
      last_sync_at timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists discord_bridge_channel_mappings (
      id text primary key,
      server_id text not null references servers(id) on delete cascade,
      guild_id text not null,
      discord_channel_id text not null,
      discord_channel_name text not null,
      matrix_channel_id text not null references channels(id) on delete cascade,
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (server_id, discord_channel_id),
      unique (server_id, matrix_channel_id)
    );

    create table if not exists platform_settings (
      id text primary key,
      bootstrap_completed_at timestamptz,
      bootstrap_admin_user_id text,
      bootstrap_hub_id text,
      default_server_id text,
      default_channel_id text
    );

    alter table channels add column if not exists is_locked boolean not null default false;
    alter table channels add column if not exists slow_mode_seconds integer not null default 0;
    alter table channels add column if not exists posting_restricted_to_roles text[] not null default '{}';
    alter table channels add column if not exists voice_sfu_room_id text;
    alter table channels add column if not exists voice_max_participants integer;
    alter table channels add column if not exists video_enabled boolean not null default false;
    alter table channels add column if not exists video_max_participants integer;
    alter table chat_messages add column if not exists author_display_name text not null default 'Unknown';
    alter table voice_presence add column if not exists video_enabled boolean not null default false;
    alter table voice_presence add column if not exists video_quality text not null default 'medium';
    alter table platform_settings add column if not exists bootstrap_completed_at timestamptz;
    alter table platform_settings add column if not exists bootstrap_admin_user_id text;
    alter table platform_settings add column if not exists bootstrap_hub_id text;
    alter table platform_settings add column if not exists default_server_id text;
    alter table platform_settings add column if not exists default_channel_id text;
    alter table servers add column if not exists owner_user_id text;
    update servers set owner_user_id = created_by_user_id where owner_user_id is null;
    update role_bindings
    set role = case role
      when 'hub_operator' then 'hub_admin'
      when 'creator_admin' then 'space_owner'
      when 'creator_moderator' then 'space_moderator'
      when 'member' then 'user'
      else role
    end
    where role in ('hub_operator', 'creator_admin', 'creator_moderator', 'member');
    update role_assignment_audit_logs
    set role = case role
      when 'hub_operator' then 'hub_admin'
      when 'creator_admin' then 'space_owner'
      when 'creator_moderator' then 'space_moderator'
      when 'member' then 'user'
      else role
    end
    where role in ('hub_operator', 'creator_admin', 'creator_moderator', 'member');
    update channels
    set posting_restricted_to_roles = (
      select coalesce(
        array_agg(
          case role_name
            when 'hub_operator' then 'hub_admin'
            when 'creator_admin' then 'space_owner'
            when 'creator_moderator' then 'space_moderator'
            when 'member' then 'user'
            else role_name
          end
        ),
        '{}'::text[]
      )
      from unnest(posting_restricted_to_roles) as role_name
    )
    where posting_restricted_to_roles && array['hub_operator', 'creator_admin', 'creator_moderator', 'member']::text[];
    update delegation_audit_events
    set action_type = case action_type
      when 'space_admin_assigned' then 'space_owner_assigned'
      when 'space_admin_revoked' then 'space_owner_revoked'
      when 'space_admin_transfer_started' then 'space_owner_transfer_started'
      when 'space_admin_transfer_completed' then 'space_owner_transfer_completed'
      else action_type
    end
    where action_type in (
      'space_admin_assigned',
      'space_admin_revoked',
      'space_admin_transfer_started',
      'space_admin_transfer_completed'
    );
    alter table channels add column if not exists position integer not null default 0;
    alter table categories add column if not exists position integer not null default 0;
    alter table identity_mappings add column if not exists settings jsonb;
    alter table hubs add column if not exists theme jsonb;
    alter table hubs add column if not exists space_customization_limits jsonb;
    alter table hubs add column if not exists oidc_config jsonb;
    alter table servers add column if not exists starting_channel_id text;
    alter table servers add column if not exists visibility text default 'public';
    alter table servers add column if not exists visitor_privacy text default 'public';
    alter table channels add column if not exists restricted_visibility boolean not null default false;
    alter table channels add column if not exists allowed_role_ids text[] not null default '{}';
    alter table hubs add column if not exists allow_space_discord_bridge boolean not null default true;
    alter table hubs add column if not exists s3_config jsonb;
    alter table identity_mappings add column if not exists access_token text;
    alter table identity_mappings add column if not exists refresh_token text;
    alter table identity_mappings add column if not exists token_expires_at timestamptz;
    alter table channel_read_states add column if not exists is_muted boolean not null default false;
  `);
}
