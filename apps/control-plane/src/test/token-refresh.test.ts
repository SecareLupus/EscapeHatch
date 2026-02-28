import test from "node:test";
import assert from "node:assert/strict";
import { initDb, pool } from "../db/client.js";
import { upsertIdentityMapping, getIdentityByProductUserId, ensureIdentityTokenValid } from "../services/identity-service.js";
import { isTokenExpired } from "../auth/oidc.js";

async function resetDb(): Promise<void> {
    if (!pool) return;
    await pool.query("begin");
    try {
        await pool.query("delete from identity_mappings");
        await pool.query("commit");
    } catch (error) {
        await pool.query("rollback");
        throw error;
    }
}

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

    await initDb();
    await resetDb();

    // 1. Create an identity with an expired token
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

    // 2. Mock global fetch for the refresh call
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, options?: RequestInit) => {
        return {
            ok: true,
            json: async () => ({
                access_token: "new_access_token",
                refresh_token: "new_refresh_token",
                expires_in: 3600
            })
        } as Response;
    }) as typeof fetch;

    try {
        // 3. Call ensureIdentityTokenValid
        await ensureIdentityTokenValid(identity.productUserId);

        // 4. Verify the database was updated
        const updated = await getIdentityByProductUserId(identity.productUserId);
        assert.equal(updated?.accessToken, "new_access_token");
        assert.equal(updated?.refreshToken, "new_refresh_token");
        assert.ok(updated?.tokenExpiresAt && new Date(updated.tokenExpiresAt).getTime() > Date.now());
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("ensureIdentityTokenValid does nothing if token is valid", async (t) => {
    if (!pool) {
        t.skip("DATABASE_URL not configured.");
        return;
    }

    await initDb();
    await resetDb();

    // 1. Create an identity with a valid token
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

    // 2. Mock global fetch (should NOT be called)
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    try {
        await ensureIdentityTokenValid(identity.productUserId);

        const after = await getIdentityByProductUserId(identity.productUserId);
        assert.equal(after?.accessToken, "original_access_token");
        assert.equal(fetchCalled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
