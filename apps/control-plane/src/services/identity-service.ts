import crypto from "node:crypto";
import type { IdentityMapping } from "@escapehatch/shared";
import { withDb } from "../db/client.js";

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function mapRow(result: {
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
}): IdentityMapping {
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
}): Promise<IdentityMapping> {
  return withDb(async (db) => {
    const existing = await db.query<{ id: string; product_user_id: string }>(
      "select id, product_user_id from identity_mappings where provider = $1 and oidc_subject = $2 limit 1",
      [input.provider, input.oidcSubject]
    );

    const existingRow = existing.rows[0];
    const id = existingRow?.id ?? randomId("idm");
    const productUserId = existingRow?.product_user_id ?? randomId("usr");

    await db.query(
      `insert into identity_mappings
      (id, provider, oidc_subject, email, preferred_username, avatar_url, matrix_user_id, product_user_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (provider, oidc_subject)
      do update set
        email = excluded.email,
        preferred_username = excluded.preferred_username,
        avatar_url = excluded.avatar_url,
        updated_at = now()`,
      [id, input.provider, input.oidcSubject, input.email, input.preferredUsername, input.avatarUrl, null, productUserId]
    );

    const row = await db.query<{
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
    }>("select * from identity_mappings where provider = $1 and oidc_subject = $2", [
      input.provider,
      input.oidcSubject
    ]);

    const result = row.rows[0];
    if (!result) {
      throw new Error("Identity mapping upsert failed.");
    }

    return mapRow(result);
  });
}

export async function getIdentityByProductUserId(productUserId: string): Promise<IdentityMapping | null> {
  return withDb(async (db) => {
    const row = await db.query<{
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
    }>("select * from identity_mappings where product_user_id = $1 order by created_at asc limit 1", [
      productUserId
    ]);

    const result = row.rows[0];
    return result ? mapRow(result) : null;
  });
}
