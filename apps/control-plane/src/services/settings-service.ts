import { withDb } from "../db/client.js";
import type { Hub, Server, Channel } from "@escapehatch/shared";

export async function getHubSettings(hubId: string): Promise<Partial<Hub>> {
  return withDb(async (db) => {
    const res = await db.query(
      "select theme, space_customization_limits, oidc_config from hubs where id = $1",
      [hubId]
    );
    const row = res.rows[0];
    if (!row) throw new Error("Hub not found");
    return {
      theme: row.theme,
      spaceCustomizationLimits: row.space_customization_limits,
      oidcConfig: row.oidc_config
    };
  });
}

export async function updateHubSettings(hubId: string, settings: {
  theme?: any;
  spaceCustomizationLimits?: any;
  oidcConfig?: any;
}): Promise<void> {
  return withDb(async (db) => {
    await db.query(
      `update hubs set 
        theme = case when $2::jsonb is not null then $2::jsonb else theme end,
        space_customization_limits = case when $3::jsonb is not null then $3::jsonb else space_customization_limits end,
        oidc_config = case when $4::jsonb is not null then $4::jsonb else oidc_config end
      where id = $1`,
      [hubId, settings.theme ? JSON.stringify(settings.theme) : null, settings.spaceCustomizationLimits ? JSON.stringify(settings.spaceCustomizationLimits) : null, settings.oidcConfig ? JSON.stringify(settings.oidcConfig) : null]
    );
  });
}

export async function getServerSettings(serverId: string): Promise<Partial<Server>> {
  return withDb(async (db) => {
    const res = await db.query(
      "select starting_channel_id, visibility, visitor_privacy from servers where id = $1",
      [serverId]
    );
    const row = res.rows[0];
    if (!row) throw new Error("Server not found");
    return {
      startingChannelId: row.starting_channel_id,
      visibility: row.visibility,
      visitorPrivacy: row.visitor_privacy
    };
  });
}

export async function updateServerSettings(serverId: string, settings: {
  startingChannelId?: string | null;
  visibility?: string;
  visitorPrivacy?: string;
}): Promise<void> {
  return withDb(async (db) => {
    // Note: use undefined check for startingChannelId to allow nulling it out
    await db.query(
      `update servers set 
        starting_channel_id = case when $2::text is not null or $5::boolean then $2::text else starting_channel_id end,
        visibility = coalesce($3, visibility),
        visitor_privacy = coalesce($4, visitor_privacy)
      where id = $1`,
      [
        serverId, 
        settings.startingChannelId, 
        settings.visibility, 
        settings.visitorPrivacy,
        settings.startingChannelId === null
      ]
    );
  });
}

export async function getChannelSettings(channelId: string): Promise<Partial<Channel>> {
  return withDb(async (db) => {
    const res = await db.query(
      "select restricted_visibility, allowed_role_ids from channels where id = $1",
      [channelId]
    );
    const row = res.rows[0];
    if (!row) throw new Error("Channel not found");
    return {
      restrictedVisibility: row.restricted_visibility,
      allowedRoleIds: row.allowed_role_ids
    };
  });
}

export async function updateChannelSettings(channelId: string, settings: {
  restrictedVisibility?: boolean;
  allowedRoleIds?: string[];
}): Promise<void> {
  return withDb(async (db) => {
    await db.query(
      `update channels set 
        restricted_visibility = coalesce($2, restricted_visibility),
        allowed_role_ids = coalesce($3, allowed_role_ids)
      where id = $1`,
      [
        channelId, 
        settings.restrictedVisibility, 
        settings.allowedRoleIds
      ]
    );
  });
}

export async function getUserSettings(productUserId: string): Promise<Record<string, any>> {
  return withDb(async (db) => {
    const res = await db.query(
      "select settings from identity_mappings where product_user_id = $1 limit 1",
      [productUserId]
    );
    const row = res.rows[0];
    return row?.settings || {};
  });
}

export async function updateUserSettings(productUserId: string, settings: Record<string, any>): Promise<void> {
  return withDb(async (db) => {
    // Update all identity mappings for this product user
    await db.query(
      "update identity_mappings set settings = $2 where product_user_id = $1",
      [productUserId, JSON.stringify(settings)]
    );
  });
}
