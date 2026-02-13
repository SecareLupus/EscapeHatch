import test from "node:test";
import assert from "node:assert/strict";
import { bindingAllowsAction, bindingMatchesScope } from "../services/policy-service.js";

test("creator moderator cannot ban users", () => {
  const allowed = bindingAllowsAction(
    {
      role: "creator_moderator",
      hub_id: null,
      server_id: "srv_1",
      channel_id: null
    },
    "moderation.ban"
  );

  assert.equal(allowed, false);
});

test("cross-scope moderation is rejected", () => {
  const matches = bindingMatchesScope(
    {
      role: "creator_moderator",
      hub_id: null,
      server_id: "srv_primary",
      channel_id: null
    },
    {
      serverId: "srv_other"
    }
  );

  assert.equal(matches, false);
});
