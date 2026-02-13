import test from "node:test";
import assert from "node:assert/strict";
import { discordLoginUrl } from "../lib/control-plane";

test("discordLoginUrl points at control-plane login endpoint", () => {
  assert.equal(discordLoginUrl(), "http://localhost:4000/auth/login/discord");
});
