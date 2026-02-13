import crypto from "node:crypto";
import type { IdentityMapping } from "@escapehatch/shared";
import { withDb } from "../db/client.js";

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

interface IdentityRow {
  id: string;
  provider: IdentityMapping["provider"];
  oidc_subject: string;
  email: string | null;
  preferred_username: string | null;
  avatar_url: string | null;
  matrix_user_id: string | null;
  product_user_id: string;
  created_at: string;
  updated_at: string;
}

function mapRow(result: IdentityRow): IdentityMapping {
  return {
    id: result.id,
    provider: result.provider,
    oidcSubject: result.oidc_subject,
    email: result.email,
    preferredUsername: result.preferred_username,
    avatarUrl: result.avatar_url,
    matrixUserId: result.matrix_user_id,
    productUserId: result.product_user_id,
    createdAt: result.created_at,
    updatedAt: result.updated_at
  };
}

export async function upsertIdentityMapping(input: {
  provider: IdentityMapping["provider"];
  oidcSubject: string;
  email: string | null;
  preferredUsername: string | null;
  avatarUrl: string | null;
  productUserId?: string;
}): Promise<IdentityMapping> {
  return withDb(async (db) => {
    const row = await db.query<IdentityRow>(
      `insert into identity_mappings
       (id, provider, oidc_subject, email, preferred_username, avatar_url, matrix_user_id, product_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (provider, oidc_subject)
       do update set
         email = excluded.email,
         preferred_username = coalesce(identity_mappings.preferred_username, excluded.preferred_username),
         avatar_url = excluded.avatar_url,
         updated_at = now()
       returning *`,
      [
        randomId("idm"),
        input.provider,
        input.oidcSubject,
        input.email,
        input.preferredUsername,
        input.avatarUrl,
        null,
        input.productUserId ?? randomId("usr")
      ]
    );

    const result = row.rows[0];
    if (!result) {
      throw new Error("Identity mapping upsert failed.");
    }

    return mapRow(result);
  });
}

export async function getIdentityByProductUserId(productUserId: string): Promise<IdentityMapping | null> {
  return withDb(async (db) => {
    const row = await db.query<IdentityRow>(
      `select *
       from identity_mappings
       where product_user_id = $1
       order by (preferred_username is not null) desc, updated_at desc, created_at asc
       limit 1`,
      [productUserId]
    );

    const result = row.rows[0];
    return result ? mapRow(result) : null;
  });
}

export async function getIdentityByProviderSubject(input: {
  provider: IdentityMapping["provider"];
  oidcSubject: string;
}): Promise<IdentityMapping | null> {
  return withDb(async (db) => {
    const row = await db.query<IdentityRow>(
      "select * from identity_mappings where provider = $1 and oidc_subject = $2 limit 1",
      [input.provider, input.oidcSubject]
    );
    const result = row.rows[0];
    return result ? mapRow(result) : null;
  });
}

export async function listIdentitiesByProductUserId(productUserId: string): Promise<IdentityMapping[]> {
  return withDb(async (db) => {
    const row = await db.query<IdentityRow>(
      `select *
       from identity_mappings
       where product_user_id = $1
       order by created_at asc`,
      [productUserId]
    );
    return row.rows.map(mapRow);
  });
}

export async function setPreferredUsernameForProductUser(input: {
  productUserId: string;
  preferredUsername: string;
}): Promise<void> {
  await withDb(async (db) => {
    const result = await db.query(
      `update identity_mappings
       set preferred_username = $2, updated_at = now()
       where product_user_id = $1`,
      [input.productUserId, input.preferredUsername]
    );
    if ((result.rowCount ?? 0) < 1) {
      throw new Error("No identities found for user.");
    }
  });
}

export async function isOnboardingComplete(productUserId: string): Promise<boolean> {
  return withDb(async (db) => {
    const row = await db.query<{ complete: boolean }>(
      `select exists(
         select 1
         from identity_mappings
         where product_user_id = $1
           and preferred_username is not null
           and length(trim(preferred_username)) > 0
       ) as complete`,
      [productUserId]
    );
    return Boolean(row.rows[0]?.complete);
  });
}

export async function findUniqueProductUserIdByEmail(email: string): Promise<string | null> {
  return withDb(async (db) => {
    const row = await db.query<{ product_user_id: string }>(
      `select product_user_id
       from identity_mappings
       where email is not null
         and lower(email) = lower($1)
       group by product_user_id
       order by min(created_at) asc
       limit 2`,
      [email]
    );
    if (row.rows.length !== 1) {
      return null;
    }
    return row.rows[0]?.product_user_id ?? null;
  });
}

export async function isPreferredUsernameTaken(input: {
  preferredUsername: string;
  excludingProductUserId?: string;
}): Promise<boolean> {
  return withDb(async (db) => {
    const row = await db.query<{ taken: boolean }>(
      `select exists(
         select 1
         from identity_mappings
         where preferred_username is not null
           and lower(preferred_username) = lower($1)
           and ($2::text is null or product_user_id <> $2)
       ) as taken`,
      [input.preferredUsername, input.excludingProductUserId ?? null]
    );
    return Boolean(row.rows[0]?.taken);
  });
}
