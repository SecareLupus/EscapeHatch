import test from "node:test";
import assert from "node:assert/strict";
import { initDb, pool } from "../db/client.js";
import { listHubsForUser } from "../services/hub-service.js";

async function resetDb(): Promise<void> {
  if (!pool) return;
  await pool.query("begin");
  try {
    await pool.query("delete from mention_markers");
    await pool.query("delete from channel_read_states");
    await pool.query("delete from chat_messages");
    await pool.query("delete from channels");
    await pool.query("delete from categories");
    await pool.query("delete from servers");
    await pool.query("delete from role_bindings");
    await pool.query("delete from hubs");
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
}

test("hub service listHubsForUser", async (t) => {
  if (!pool) {
    t.skip("DATABASE_URL not configured.");
    return;
  }

  await initDb();
  await resetDb();

  // Create hubs
  await pool.query(`insert into hubs (id, name, owner_user_id) values ('hub_1', 'Hub 1', 'user_a')`);
  await pool.query(`insert into hubs (id, name, owner_user_id) values ('hub_2', 'Hub 2', 'user_b')`);

  // User A should see Hub 1 as owner
  const userAHubs = await listHubsForUser("user_a");
  assert.equal(userAHubs.length, 1);
  assert.equal(userAHubs[0]?.id, "hub_1");

  // User B should see Hub 2 as owner
  const userBHubs = await listHubsForUser("user_b");
  assert.equal(userBHubs.length, 1);
  assert.equal(userBHubs[0]?.id, "hub_2");

  // Assign user_c as hub_admin to Hub 1
  await pool.query(`insert into role_bindings (id, product_user_id, role, hub_id) values ('rb_1', 'user_c', 'hub_admin', 'hub_1')`);
  
  const userCHubs = await listHubsForUser("user_c");
  assert.equal(userCHubs.length, 1);
  assert.equal(userCHubs[0]?.id, "hub_1");

  // Assign user_global as global hub_admin (hub_id null)
  await pool.query(`insert into role_bindings (id, product_user_id, role, hub_id) values ('rb_2', 'user_global', 'hub_admin', null)`);
  
  const globalHubs = await listHubsForUser("user_global");
  assert.equal(globalHubs.length, 2);
  // Ordered by created_at asc usually
  assert.equal(globalHubs[0]?.id, "hub_1");
  assert.equal(globalHubs[1]?.id, "hub_2");
});
