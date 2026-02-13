import test from "node:test";
import assert from "node:assert/strict";
import { bindingAllowsAction, bindingMatchesScope } from "../services/policy-service.js";

test("space moderator can ban users within scope", () => {
  const allowed = bindingAllowsAction(
    {
      role: "space_moderator",
      hub_id: null,
      server_id: "srv_1",
      channel_id: null
    },
    "moderation.ban"
  );

  assert.equal(allowed, true);
});

test("cross-scope moderation is rejected", () => {
  const matches = bindingMatchesScope(
    {
      role: "space_moderator",
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
