import test from "node:test";
import assert from "node:assert/strict";
import { providerLoginUrl } from "../lib/control-plane";

test("providerLoginUrl builds Discord auth route", () => {
  assert.equal(providerLoginUrl("discord"), "http://localhost:4000/auth/login/discord");
});

test("providerLoginUrl builds developer login route", () => {
  assert.equal(providerLoginUrl("dev", "alice"), "http://localhost:4000/auth/dev-login?username=alice");
});
