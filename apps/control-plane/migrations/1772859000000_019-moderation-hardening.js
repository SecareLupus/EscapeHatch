export async function up(pgm) {
  // 1. Extend moderation_time_restrictions for multi-level scoping
  pgm.addColumns("moderation_time_restrictions", {
    hub_id: { type: "text", references: '"hubs"', onDelete: "CASCADE" },
    channel_id: { type: "text", references: '"channels"', onDelete: "CASCADE" },
  });
  // Update server_id to be optional for Hub-level restrictions
  pgm.alterColumn("moderation_time_restrictions", "server_id", { allowNull: true });

  // 2. Extend moderation_actions for Hub-level scoping
  pgm.addColumns("moderation_actions", {
    hub_id: { type: "text", references: '"hubs"', onDelete: "CASCADE" },
  });
  pgm.alterColumn("moderation_actions", "server_id", { allowNull: true });

  // 3. Create moderation_warnings table
  pgm.createTable("moderation_warnings", {
    id: { type: "text", primaryKey: true },
    hub_id: { type: "text", references: '"hubs"', onDelete: "CASCADE", notNull: false },
    server_id: { type: "text", references: '"servers"', onDelete: "CASCADE", notNull: false },
    channel_id: { type: "text", references: '"channels"', onDelete: "CASCADE", notNull: false },
    target_user_id: { type: "text", notNull: true },
    actor_user_id: { type: "text", notNull: true },
    reason: { type: "text", notNull: true },
    message_id: { type: "text" },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  // 4. Create moderation_strikes table
  pgm.createTable("moderation_strikes", {
    id: { type: "text", primaryKey: true },
    hub_id: { type: "text", references: '"hubs"', onDelete: "CASCADE", notNull: false },
    server_id: { type: "text", references: '"servers"', onDelete: "CASCADE", notNull: false },
    channel_id: { type: "text", references: '"channels"', onDelete: "CASCADE", notNull: false },
    target_user_id: { type: "text", notNull: true },
    actor_user_id: { type: "text", notNull: true },
    reason: { type: "text", notNull: true },
    action_taken: { type: "text" }, // e.g., 'none', 'timeout', 'kick', 'ban'
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  // Indexing for quick lookups by target user and scope
  pgm.createIndex("moderation_warnings", ["target_user_id", "hub_id"]);
  pgm.createIndex("moderation_warnings", ["target_user_id", "server_id"]);
  pgm.createIndex("moderation_strikes", ["target_user_id", "hub_id"]);
  pgm.createIndex("moderation_strikes", ["target_user_id", "server_id"]);
}

export async function down(pgm) {
  pgm.dropTable("moderation_strikes");
  pgm.dropTable("moderation_warnings");
  pgm.dropColumns("moderation_actions", ["hub_id"]);
  pgm.alterColumn("moderation_actions", "server_id", { allowNull: false });
  pgm.dropColumns("moderation_time_restrictions", ["hub_id", "channel_id"]);
  pgm.alterColumn("moderation_time_restrictions", "server_id", { allowNull: false });
}
