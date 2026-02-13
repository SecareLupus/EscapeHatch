import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SERVER_BLUEPRINT } from "../index.js";

test("default server blueprint includes required channels", () => {
  const names = DEFAULT_SERVER_BLUEPRINT.defaultChannels.map((channel) => channel.name);
  assert.deepEqual(names, ["announcements", "general", "voice-lounge"]);
});
