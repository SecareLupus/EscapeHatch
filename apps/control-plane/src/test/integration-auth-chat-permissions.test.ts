import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";

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
