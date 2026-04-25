import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../config.js";
import { initDb, pool } from "../db/client.js";
import { upsertIdentityMapping, getIdentityByProductUserId, ensureIdentityTokenValid } from "../services/identity-service.js";
import { isTokenExpired } from "../auth/oidc.js";
import { resetDb } from "./helpers/reset-db.js";
import { withMockedFetch } from "./helpers/fetch-mock.js";

// `refreshDiscordToken()` throws early if client creds are missing. Inject
// placeholders so it falls through to the mocked global fetch instead.
config.oidc.discordClientId = config.oidc.discordClientId ?? "test_discord_client";
config.oidc.discordClientSecret = config.oidc.discordClientSecret ?? "test_discord_secret";

beforeEach(async () => {
    if (pool) {
        await initDb();
        await resetDb();
    }
});

test("isTokenExpired helper", () => {
    const now = Date.now();

    // Far in the future
    assert.equal(isTokenExpired(new Date(now + 1000 * 60 * 60).toISOString()), false);

    // Just about to expire (within 5 min buffer)
    assert.equal(isTokenExpired(new Date(now + 1000 * 60 * 2).toISOString()), true);

    // Already expired
    assert.equal(isTokenExpired(new Date(now - 1000).toISOString()), true);

    // No expiry
    assert.equal(isTokenExpired(null), false);
});

test("ensureIdentityTokenValid refreshes token when expired", async (t) => {
    if (!pool) {
        t.skip("DATABASE_URL not configured.");
        return;
    }

    const expiredTime = new Date(Date.now() - 1000).toISOString();
    const identity = await upsertIdentityMapping({
        provider: "discord",
        oidcSubject: "discord_user_refresh_test",
        email: "refresh_test@discord.com",
        preferredUsername: "refreshtester",
        avatarUrl: null,
        accessToken: "old_access_token",
        refreshToken: "old_refresh_token",
        tokenExpiresAt: expiredTime
    });

    const mockFetch = (async () => ({
        ok: true,
        json: async () => ({
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
            expires_in: 3600
        })
    } as Response)) as typeof fetch;

    await withMockedFetch(mockFetch, async () => {
        await ensureIdentityTokenValid(identity.productUserId);

        const updated = await getIdentityByProductUserId(identity.productUserId);
        assert.equal(updated?.accessToken, "new_access_token");
        assert.equal(updated?.refreshToken, "new_refresh_token");
        assert.ok(updated?.tokenExpiresAt && new Date(updated.tokenExpiresAt).getTime() > Date.now());
    });
});

test("ensureIdentityTokenValid does nothing if token is valid", async (t) => {
    if (!pool) {
        t.skip("DATABASE_URL not configured.");
        return;
    }

    const validTime = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    const identity = await upsertIdentityMapping({
        provider: "discord",
        oidcSubject: "discord_user_valid_test",
        email: "valid_test@discord.com",
        preferredUsername: "validtester",
        avatarUrl: null,
        accessToken: "original_access_token",
        refreshToken: "original_refresh_token",
        tokenExpiresAt: validTime
    });

    let fetchCalled = false;
    const mockFetch = (async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    await withMockedFetch(mockFetch, async () => {
        await ensureIdentityTokenValid(identity.productUserId);

        const after = await getIdentityByProductUserId(identity.productUserId);
        assert.equal(after?.accessToken, "original_access_token");
        assert.equal(fetchCalled, false);
    });
});
