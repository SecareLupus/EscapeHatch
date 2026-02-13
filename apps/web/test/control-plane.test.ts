import test from "node:test";
import assert from "node:assert/strict";
import {
  ControlPlaneApiError,
  fetchAllowedActions,
  providerLoginUrl
} from "../lib/control-plane";

test("providerLoginUrl builds Discord auth route", () => {
  assert.equal(providerLoginUrl("discord"), "http://localhost:4000/auth/login/discord");
});

test("providerLoginUrl builds developer login route", () => {
  assert.equal(providerLoginUrl("dev", "alice"), "http://localhost:4000/auth/dev-login?username=alice");
});

test("api errors include correlation request id when available", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        message: "Forbidden",
        code: "forbidden_scope",
        requestId: "req_test_123"
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json", "x-request-id": "req_header_ignored" }
      }
    )) as typeof fetch;

  try {
    await assert.rejects(
      async () => {
        await fetchAllowedActions("srv_test");
      },
      (error) => {
        assert.ok(error instanceof ControlPlaneApiError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "forbidden_scope");
        assert.equal(error.requestId, "req_test_123");
        assert.match(error.message, /request req_test_123/);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});
