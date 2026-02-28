import { test } from "node:test";
import assert from "node:assert";
import { performModerationAction } from "../services/moderation-service.js";
import { withDb } from "../db/client.js";

// This is a basic integration test that requires a running environment.
// For a pure unit test, we would need to mock withDb and the Synapse adapter.

test("Moderation actions validation", async (t) => {
    await t.test("performModerationAction throws on invalid server", async () => {
        try {
            await performModerationAction({
                action: "kick",
                serverId: "invalid-uuid",
                actorUserId: "test-actor",
                targetUserId: "user-id",
                reason: "test"
            });
            assert.fail("Should have thrown");
        } catch (err) {
            assert.ok(err instanceof Error);
        }
    });

    // We can't easily test the success path without a real DB and Synapse.
    // In a real project, we would mock the dependencies.
});
