import test from "node:test";
import assert from "node:assert/strict";
import { initDb, pool } from "../db/client.js";
import { bindingAllowsAction, bindingMatchesScope, grantRole, canManageServer, listAllowedActions } from "../services/policy-service.js";

async function resetDb(): Promise<void> {
  if (!pool) return;
  await pool.query("begin");
  try {
    await pool.query("delete from mention_markers");
    await pool.query("delete from channel_read_states");
    await pool.query("delete from chat_messages");
    await pool.query("delete from channels");
    await pool.query("delete from categories");
    await pool.query("delete from space_admin_assignments");
    await pool.query("delete from servers");
    await pool.query("delete from role_assignment_audit_logs");
    await pool.query("delete from role_bindings");
    await pool.query("delete from hubs");
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
}

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

test("grantRole and canManageServer integration", async (t) => {
  if (!pool) {
    t.skip("DATABASE_URL not configured.");
    return;
  }

  await initDb();
  await resetDb();

  // Create a hub and a server
  await pool.query(`insert into hubs (id, name, owner_user_id) values ('hub_1', 'Hub 1', 'owner_1')`);
  await pool.query(`insert into servers (id, hub_id, owner_user_id, created_by_user_id, name) values ('srv_1', 'hub_1', 'owner_1', 'owner_1', 'Server 1')`);

  // owner_1 can manage server because they are the owner
  const isOwnerManaged = await canManageServer({ productUserId: "owner_1", serverId: "srv_1" });
  assert.equal(isOwnerManaged, true);

  // user_2 cannot manage
  const isUser2Managed = await canManageServer({ productUserId: "user_2", serverId: "srv_1" });
  assert.equal(isUser2Managed, false);

  // owner_1 grants space_moderator to user_2
  await grantRole({
    actorUserId: "owner_1",
    productUserId: "user_2",
    role: "space_moderator",
    serverId: "srv_1"
  });

  // user_2 can now ban users
  const allowedUser2 = await listAllowedActions({ productUserId: "user_2", scope: { serverId: "srv_1" } });
  assert.ok(allowedUser2.includes("moderation.ban"));

  // Check audit log
  const auditLogs = await pool.query("select * from role_assignment_audit_logs where target_user_id = 'user_2'");
  assert.equal(auditLogs.rows.length, 1);
  assert.equal(auditLogs.rows[0].role, "space_moderator");
  assert.equal(auditLogs.rows[0].outcome, "granted");
});
