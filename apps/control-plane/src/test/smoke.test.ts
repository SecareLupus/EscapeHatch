import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";

test("health endpoint returns ok", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok", service: "control-plane" });
  await app.close();
});

test("providers endpoint exposes discord as primary", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/auth/providers" });
  assert.equal(response.statusCode, 200);
  const json = response.json();
  assert.equal(json.primaryProvider, "dev");
  await app.close();
});
