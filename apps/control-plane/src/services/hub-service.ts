import type { Hub, Role } from "@escapehatch/shared";
import { withDb } from "../db/client.js";

const MANAGER_ROLES: Role[] = ["hub_admin", "space_owner"];

export async function listHubsForUser(productUserId: string): Promise<Hub[]> {
  return withDb(async (db) => {
    const roleRows = await db.query<{ role: Role; hub_id: string | null }>(
      `select role, hub_id
       from role_bindings
       where product_user_id = $1`,
      [productUserId]
    );

    const isGlobalManager = roleRows.rows.some(
      (row) => MANAGER_ROLES.includes(row.role) && row.hub_id === null
    );

    if (isGlobalManager) {
      const all = await db.query<{
        id: string;
        name: string;
        owner_user_id: string;
        s3_config: any;
        created_at: string;
      }>("select * from hubs order by created_at asc");

      return all.rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerUserId: row.owner_user_id,
        s3Config: row.s3_config ?? undefined,
        createdAt: row.created_at
      }));
    }

    const scopedHubIds = new Set(
      roleRows.rows
        .filter((row) => MANAGER_ROLES.includes(row.role))
        .map((row) => row.hub_id)
        .filter((value): value is string => typeof value === "string")
    );

    const owned = await db.query<{ id: string }>("select id from hubs where owner_user_id = $1", [productUserId]);
    for (const row of owned.rows) {
      scopedHubIds.add(row.id);
    }

    const ids = [...scopedHubIds];
    if (ids.length === 0) {
      return [];
    }

    const hubs = await db.query<{
      id: string;
      name: string;
      owner_user_id: string;
      s3_config: any;
      created_at: string;
    }>("select * from hubs where id = any($1::text[]) order by created_at asc", [ids]);

    return hubs.rows.map((row) => ({
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      s3Config: row.s3_config ?? undefined,
      createdAt: row.created_at
    }));
  });
}
