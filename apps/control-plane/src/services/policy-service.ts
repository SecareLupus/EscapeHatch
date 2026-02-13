import crypto from "node:crypto";
import type { Role } from "@escapehatch/shared";
import { withDb } from "../db/client.js";

export type PrivilegedAction =
  | "moderation.kick"
  | "moderation.ban"
  | "moderation.unban"
  | "moderation.timeout"
  | "moderation.redact"
  | "channel.lock"
  | "channel.unlock"
  | "channel.slowmode"
  | "channel.posting"
  | "voice.token.issue"
  | "reports.triage"
  | "audit.read";

const permissionMatrix: Record<Role, PrivilegedAction[]> = {
  hub_operator: [
    "moderation.kick",
    "moderation.ban",
    "moderation.unban",
    "moderation.timeout",
    "moderation.redact",
    "channel.lock",
    "channel.unlock",
    "channel.slowmode",
    "channel.posting",
    "voice.token.issue",
    "reports.triage",
    "audit.read"
  ],
  creator_admin: [
    "moderation.kick",
    "moderation.ban",
    "moderation.unban",
    "moderation.timeout",
    "moderation.redact",
    "channel.lock",
    "channel.unlock",
    "channel.slowmode",
    "channel.posting",
    "voice.token.issue",
    "reports.triage",
    "audit.read"
  ],
  creator_moderator: [
    "moderation.kick",
    "moderation.timeout",
    "moderation.redact",
    "channel.lock",
    "channel.unlock",
    "channel.slowmode",
    "reports.triage",
    "audit.read"
  ],
  member: ["voice.token.issue"]
};

export interface Scope {
  hubId?: string;
  serverId?: string;
  channelId?: string;
}

interface RoleBinding {
  role: Role;
  hub_id: string | null;
  server_id: string | null;
  channel_id: string | null;
}

const MANAGER_ROLES: Role[] = ["hub_operator", "creator_admin"];

export function bindingMatchesScope(binding: RoleBinding, scope: Scope): boolean {
  const hubMatches = !binding.hub_id || !scope.hubId || binding.hub_id === scope.hubId;
  const serverMatches = !binding.server_id || !scope.serverId || binding.server_id === scope.serverId;
  const channelMatches = !binding.channel_id || !scope.channelId || binding.channel_id === scope.channelId;
  return hubMatches && serverMatches && channelMatches;
}

export function bindingAllowsAction(binding: RoleBinding, action: PrivilegedAction): boolean {
  return permissionMatrix[binding.role].includes(action);
}

export async function grantRole(input: {
  productUserId: string;
  role: Role;
  hubId?: string;
  serverId?: string;
  channelId?: string;
}): Promise<void> {
  await withDb(async (db) => {
    await db.query(
      `insert into role_bindings (id, product_user_id, role, hub_id, server_id, channel_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        `rb_${crypto.randomUUID().replaceAll("-", "")}`,
        input.productUserId,
        input.role,
        input.hubId ?? null,
        input.serverId ?? null,
        input.channelId ?? null
      ]
    );
  });
}

export async function isActionAllowed(input: {
  productUserId: string;
  action: PrivilegedAction;
  scope: Scope;
}): Promise<boolean> {
  return withDb(async (db) => {
    const rows = await db.query<RoleBinding>(
      `select role, hub_id, server_id, channel_id
       from role_bindings
       where product_user_id = $1`,
      [input.productUserId]
    );

    return rows.rows.some((binding) => bindingAllowsAction(binding, input.action) && bindingMatchesScope(binding, input.scope));
  });
}

export async function listAllowedActions(input: {
  productUserId: string;
  scope: Scope;
}): Promise<PrivilegedAction[]> {
  return withDb(async (db) => {
    const rows = await db.query<RoleBinding>(
      `select role, hub_id, server_id, channel_id
       from role_bindings
       where product_user_id = $1`,
      [input.productUserId]
    );

    const actions = new Set<PrivilegedAction>();
    for (const binding of rows.rows) {
      if (!bindingMatchesScope(binding, input.scope)) {
        continue;
      }

      for (const action of permissionMatrix[binding.role]) {
        actions.add(action);
      }
    }

    return [...actions];
  });
}

export async function listRoleBindings(input: { productUserId: string }): Promise<
  Array<{
    role: Role;
    hubId: string | null;
    serverId: string | null;
    channelId: string | null;
  }>
> {
  return withDb(async (db) => {
    const rows = await db.query<RoleBinding>(
      `select role, hub_id, server_id, channel_id
       from role_bindings
       where product_user_id = $1`,
      [input.productUserId]
    );

    return rows.rows.map((row) => ({
      role: row.role,
      hubId: row.hub_id,
      serverId: row.server_id,
      channelId: row.channel_id
    }));
  });
}

export async function canManageHub(input: {
  productUserId: string;
  hubId: string;
}): Promise<boolean> {
  return withDb(async (db) => {
    const rows = await db.query<RoleBinding>(
      `select role, hub_id, server_id, channel_id
       from role_bindings
       where product_user_id = $1`,
      [input.productUserId]
    );

    return rows.rows.some(
      (binding) =>
        MANAGER_ROLES.includes(binding.role) &&
        bindingMatchesScope(binding, {
          hubId: input.hubId
        })
    );
  });
}

export async function canManageServer(input: {
  productUserId: string;
  serverId: string;
}): Promise<boolean> {
  return withDb(async (db) => {
    const server = await db.query<{ hub_id: string }>("select hub_id from servers where id = $1 limit 1", [
      input.serverId
    ]);
    const serverRow = server.rows[0];
    if (!serverRow) {
      return false;
    }

    const rows = await db.query<RoleBinding>(
      `select role, hub_id, server_id, channel_id
       from role_bindings
       where product_user_id = $1`,
      [input.productUserId]
    );

    return rows.rows.some(
      (binding) =>
        MANAGER_ROLES.includes(binding.role) &&
        bindingMatchesScope(binding, {
          hubId: serverRow.hub_id,
          serverId: input.serverId
        })
    );
  });
}
