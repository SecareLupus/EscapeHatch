import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { createSessionToken } from "../auth/session.js";
import { initDb, pool } from "../db/client.js";
import { upsertIdentityMapping } from "../services/identity-service.js";

async function resetDb(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.query("begin");
  try {
    await pool.query("delete from moderation_actions");
    await pool.query("delete from moderation_reports");
    await pool.query("delete from role_bindings");
    await pool.query("delete from chat_messages");
    await pool.query("delete from channels");
    await pool.query("delete from categories");
    await pool.query("delete from servers");
    await pool.query("delete from hubs");
    await pool.query("delete from identity_mappings");
    await pool.query("delete from idempotency_keys");
    await pool.query(
      "update platform_settings set bootstrap_completed_at = null, bootstrap_admin_user_id = null, bootstrap_hub_id = null, default_server_id = null, default_channel_id = null where id = 'global'"
    );
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
}

function createAuthCookie(input: {
  productUserId: string;
  provider?: string;
  oidcSubject?: string;
}): string {
  const token = createSessionToken({
    productUserId: input.productUserId,
    provider: input.provider ?? "dev",
    oidcSubject: input.oidcSubject ?? `sub_${input.productUserId}`,
    expiresAt: Date.now() + 60 * 60 * 1000
  });
  return `escapehatch_session=${token}`;
}

test("auth/session returns structured unauthorized error with correlation id", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/auth/session/me" });

  assert.equal(response.statusCode, 401);
  assert.ok(response.headers["x-request-id"]);
  assert.equal(response.json().code, "unauthorized");
  assert.equal(response.json().requestId, response.headers["x-request-id"]);

  await app.close();
});

test("bootstrap-admin returns unauthorized before bootstrap checks when session is missing", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/auth/bootstrap-admin",
    payload: {
      setupToken: "wrong",
      hubName: "Test Hub"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "unauthorized");
  await app.close();
});

test("chat and permissions routes return unauthorized before initialization checks without session", async () => {
  const app = await buildApp();

  const chatResponse = await app.inject({
    method: "GET",
    url: "/v1/channels/chn_test/messages?limit=10"
  });
  assert.equal(chatResponse.statusCode, 401);
  assert.equal(chatResponse.json().code, "unauthorized");

  const permissionsResponse = await app.inject({
    method: "GET",
    url: "/v1/permissions?serverId=srv_test"
  });
  assert.equal(permissionsResponse.statusCode, 401);
  assert.equal(permissionsResponse.json().code, "unauthorized");

  await app.close();
});

test("invalid provider on auth login returns structured validation error", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/auth/login/not-a-provider"
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json();
  assert.equal(payload.code, "validation_error");
  assert.equal(payload.error, "Bad Request");
  assert.ok(payload.requestId);

  await app.close();
});

test("authenticated bootstrap + provisioning context + permission gate flow", async (t) => {
  if (!pool) {
    t.skip("DATABASE_URL not configured.");
    return;
  }
  if (!config.setupBootstrapToken) {
    t.skip("SETUP_BOOTSTRAP_TOKEN not configured.");
    return;
  }

  await initDb();
  await resetDb();

  const app = await buildApp();
  try {
    const adminIdentity = await upsertIdentityMapping({
      provider: "dev",
      oidcSubject: "it_admin",
      email: "it-admin@dev.local",
      preferredUsername: "it-admin",
      avatarUrl: null
    });
    const adminCookie = createAuthCookie({
      productUserId: adminIdentity.productUserId,
      provider: "dev",
      oidcSubject: "it_admin"
    });

    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/auth/bootstrap-admin",
      headers: { cookie: adminCookie },
      payload: {
        setupToken: config.setupBootstrapToken,
        hubName: "Integration Hub"
      }
    });
    assert.equal(bootstrapResponse.statusCode, 201);
    const bootstrapBody = bootstrapResponse.json() as {
      defaultServerId: string;
      defaultChannelId: string;
    };
    assert.ok(bootstrapBody.defaultServerId);
    assert.ok(bootstrapBody.defaultChannelId);

    const sessionResponse = await app.inject({
      method: "GET",
      url: "/auth/session/me",
      headers: { cookie: adminCookie }
    });
    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.json().identity?.provider, "dev");

    const contextResponse = await app.inject({
      method: "GET",
      url: "/v1/bootstrap/context",
      headers: { cookie: adminCookie }
    });
    assert.equal(contextResponse.statusCode, 200);
    assert.equal(contextResponse.json().defaultServerId, bootstrapBody.defaultServerId);
    assert.equal(contextResponse.json().defaultChannelId, bootstrapBody.defaultChannelId);

    const permissionsResponse = await app.inject({
      method: "GET",
      url: `/v1/permissions?serverId=${bootstrapBody.defaultServerId}&channelId=${bootstrapBody.defaultChannelId}`,
      headers: { cookie: adminCookie }
    });
    assert.equal(permissionsResponse.statusCode, 200);
    assert.ok(Array.isArray(permissionsResponse.json().items));
    assert.ok(permissionsResponse.json().items.includes("channel.lock"));

    const memberIdentity = await upsertIdentityMapping({
      provider: "dev",
      oidcSubject: "it_member",
      email: "it-member@dev.local",
      preferredUsername: "it-member",
      avatarUrl: null
    });
    const memberCookie = createAuthCookie({
      productUserId: memberIdentity.productUserId,
      provider: "dev",
      oidcSubject: "it_member"
    });

    const forbiddenControlsResponse = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${bootstrapBody.defaultChannelId}/controls`,
      headers: { cookie: memberCookie },
      payload: {
        serverId: bootstrapBody.defaultServerId,
        lock: true,
        reason: "test gate"
      }
    });
    assert.equal(forbiddenControlsResponse.statusCode, 403);
    assert.equal(forbiddenControlsResponse.json().code, "forbidden_scope");
  } finally {
    await app.close();
  }
});

test("dev login establishes session when bypass is enabled", async (t) => {
  if (!config.devAuthBypass) {
    t.skip("DEV_AUTH_BYPASS is disabled.");
    return;
  }
  if (!pool) {
    t.skip("DATABASE_URL not configured.");
    return;
  }

  await initDb();
  await resetDb();
  const app = await buildApp();

  try {
    const loginResponse = await app.inject({
      method: "GET",
      url: "/auth/dev-login?username=it-dev-user"
    });
    assert.equal(loginResponse.statusCode, 302);
    const setCookie = loginResponse.headers["set-cookie"];
    assert.ok(typeof setCookie === "string" && setCookie.includes("escapehatch_session="));

    const sessionResponse = await app.inject({
      method: "GET",
      url: "/auth/session/me",
      headers: {
        cookie: setCookie
      }
    });
    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.json().identity?.provider, "dev");
  } finally {
    await app.close();
  }
});

test("read-state mention markers and voice presence flows work for scoped users", async (t) => {
  if (!pool) {
    t.skip("DATABASE_URL not configured.");
    return;
  }
  if (!config.setupBootstrapToken) {
    t.skip("SETUP_BOOTSTRAP_TOKEN not configured.");
    return;
  }

  await initDb();
  await resetDb();
  const app = await buildApp();

  try {
    const adminIdentity = await upsertIdentityMapping({
      provider: "dev",
      oidcSubject: "flow_admin",
      email: "flow-admin@dev.local",
      preferredUsername: "flow-admin",
      avatarUrl: null
    });
    const adminCookie = createAuthCookie({
      productUserId: adminIdentity.productUserId,
      provider: "dev",
      oidcSubject: "flow_admin"
    });

    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/auth/bootstrap-admin",
      headers: { cookie: adminCookie },
      payload: {
        setupToken: config.setupBootstrapToken,
        hubName: "Flow Hub"
      }
    });
    assert.equal(bootstrapResponse.statusCode, 201);
    const bootstrapBody = bootstrapResponse.json() as { defaultServerId: string; defaultChannelId: string };

    const voiceChannelResponse = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: { cookie: adminCookie },
      payload: {
        serverId: bootstrapBody.defaultServerId,
        name: "voice-room",
        type: "voice"
      }
    });
    assert.equal(voiceChannelResponse.statusCode, 201);
    const voiceChannelId = voiceChannelResponse.json().id as string;

    const memberIdentity = await upsertIdentityMapping({
      provider: "dev",
      oidcSubject: "flow_member",
      email: "flow-member@dev.local",
      preferredUsername: "flowmember",
      avatarUrl: null
    });
    const memberCookie = createAuthCookie({
      productUserId: memberIdentity.productUserId,
      provider: "dev",
      oidcSubject: "flow_member"
    });

    const grantMemberRoleResponse = await app.inject({
      method: "POST",
      url: "/v1/roles/grant",
      headers: { cookie: adminCookie },
      payload: {
        productUserId: memberIdentity.productUserId,
        role: "member",
        serverId: bootstrapBody.defaultServerId
      }
    });
    assert.equal(grantMemberRoleResponse.statusCode, 204);

    const sendMentionResponse = await app.inject({
      method: "POST",
      url: `/v1/channels/${bootstrapBody.defaultChannelId}/messages`,
      headers: { cookie: adminCookie },
      payload: {
        content: "hello @flowmember"
      }
    });
    assert.equal(sendMentionResponse.statusCode, 201);

    const memberMentionsResponse = await app.inject({
      method: "GET",
      url: `/v1/channels/${bootstrapBody.defaultChannelId}/mentions`,
      headers: { cookie: memberCookie }
    });
    assert.equal(memberMentionsResponse.statusCode, 200);
    assert.ok(memberMentionsResponse.json().items.length >= 1);

    const markReadResponse = await app.inject({
      method: "PUT",
      url: `/v1/channels/${bootstrapBody.defaultChannelId}/read-state`,
      headers: { cookie: memberCookie },
      payload: {}
    });
    assert.equal(markReadResponse.statusCode, 200);

    const memberMentionsAfterReadResponse = await app.inject({
      method: "GET",
      url: `/v1/channels/${bootstrapBody.defaultChannelId}/mentions`,
      headers: { cookie: memberCookie }
    });
    assert.equal(memberMentionsAfterReadResponse.statusCode, 200);
    assert.equal(memberMentionsAfterReadResponse.json().items.length, 0);

    const issueVoiceTokenResponse = await app.inject({
      method: "POST",
      url: "/v1/voice/token",
      headers: { cookie: memberCookie },
      payload: {
        serverId: bootstrapBody.defaultServerId,
        channelId: voiceChannelId
      }
    });
    assert.equal(issueVoiceTokenResponse.statusCode, 200);

    const joinVoiceResponse = await app.inject({
      method: "POST",
      url: "/v1/voice/presence/join",
      headers: { cookie: memberCookie },
      payload: {
        serverId: bootstrapBody.defaultServerId,
        channelId: voiceChannelId
      }
    });
    assert.equal(joinVoiceResponse.statusCode, 204);

    const updateVoiceStateResponse = await app.inject({
      method: "PATCH",
      url: "/v1/voice/presence/state",
      headers: { cookie: memberCookie },
      payload: {
        serverId: bootstrapBody.defaultServerId,
        channelId: voiceChannelId,
        muted: true,
        deafened: false
      }
    });
    assert.equal(updateVoiceStateResponse.statusCode, 204);

    const listVoicePresenceResponse = await app.inject({
      method: "GET",
      url: `/v1/voice/presence?serverId=${bootstrapBody.defaultServerId}&channelId=${voiceChannelId}`,
      headers: { cookie: memberCookie }
    });
    assert.equal(listVoicePresenceResponse.statusCode, 200);
    assert.equal(listVoicePresenceResponse.json().items.length, 1);
    assert.equal(listVoicePresenceResponse.json().items[0].muted, true);

    const leaveVoiceResponse = await app.inject({
      method: "POST",
      url: "/v1/voice/presence/leave",
      headers: { cookie: memberCookie },
      payload: {
        serverId: bootstrapBody.defaultServerId,
        channelId: voiceChannelId
      }
    });
    assert.equal(leaveVoiceResponse.statusCode, 204);
  } finally {
    await app.close();
  }
});
