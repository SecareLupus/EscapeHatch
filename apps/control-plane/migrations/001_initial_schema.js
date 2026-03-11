export const up = (pgm) => {
    // 1. identity_mappings
    pgm.createTable('identity_mappings', {
        id: { type: 'text', primaryKey: true },
        provider: { type: 'text', notNull: true },
        oidc_subject: { type: 'text', notNull: true },
        email: { type: 'text' },
        preferred_username: { type: 'text' },
        avatar_url: { type: 'text' },
        matrix_user_id: { type: 'text' },
        product_user_id: { type: 'text', notNull: true },
        theme: { type: 'text' },
        settings: { type: 'jsonb' },
        access_token: { type: 'text' },
        refresh_token: { type: 'text' },
        token_expires_at: { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, {
        ifNotExists: true,
        constraints: {
            unique: [['provider', 'oidc_subject']]
        }
    });

    // 2. hubs
    pgm.createTable('hubs', {
        id: { type: 'text', primaryKey: true },
        name: { type: 'text', notNull: true },
        owner_user_id: { type: 'text', notNull: true },
        s3_config: { type: 'jsonb' },
        allow_space_discord_bridge: { type: 'boolean', notNull: true, default: true },
        theme: { type: 'jsonb' },
        space_customization_limits: { type: 'jsonb' },
        oidc_config: { type: 'jsonb' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 3. servers
    pgm.createTable('servers', {
        id: { type: 'text', primaryKey: true },
        hub_id: { type: 'text', notNull: true, references: 'hubs', onDelete: 'CASCADE' },
        name: { type: 'text', notNull: true },
        matrix_space_id: { type: 'text' },
        created_by_user_id: { type: 'text', notNull: true },
        owner_user_id: { type: 'text' },
        starting_channel_id: { type: 'text' },
        visibility: { type: 'text', default: 'public' },
        visitor_privacy: { type: 'text', default: 'public' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 4. categories
    pgm.createTable('categories', {
        id: { type: 'text', primaryKey: true },
        server_id: { type: 'text', notNull: true, references: 'servers', onDelete: 'CASCADE' },
        name: { type: 'text', notNull: true },
        matrix_subspace_id: { type: 'text' },
        position: { type: 'integer', notNull: true, default: 0 },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 5. channels
    pgm.createTable('channels', {
        id: { type: 'text', primaryKey: true },
        server_id: { type: 'text', notNull: true, references: 'servers', onDelete: 'CASCADE' },
        category_id: { type: 'text', references: 'categories', onDelete: 'SET NULL' },
        name: { type: 'text', notNull: true },
        type: { type: 'text', notNull: true },
        matrix_room_id: { type: 'text' },
        position: { type: 'integer', notNull: true, default: 0 },
        is_locked: { type: 'boolean', notNull: true, default: false },
        slow_mode_seconds: { type: 'integer', notNull: true, default: 0 },
        posting_restricted_to_roles: { type: 'text[]', notNull: true, default: '{}' },
        voice_sfu_room_id: { type: 'text' },
        voice_max_participants: { type: 'integer' },
        video_enabled: { type: 'boolean', notNull: true, default: false },
        video_max_participants: { type: 'integer' },
        restricted_visibility: { type: 'boolean', notNull: true, default: false },
        allowed_role_ids: { type: 'text[]', notNull: true, default: '{}' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 6. idempotency_keys
    pgm.createTable('idempotency_keys', {
        idempotency_key: { type: 'text', primaryKey: true },
        request_hash: { type: 'text', notNull: true },
        response_json: { type: 'jsonb', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 7. role_bindings
    pgm.createTable('role_bindings', {
        id: { type: 'text', primaryKey: true },
        product_user_id: { type: 'text', notNull: true },
        role: { type: 'text', notNull: true },
        hub_id: { type: 'text' },
        server_id: { type: 'text' },
        channel_id: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 8. role_assignment_audit_logs
    pgm.createTable('role_assignment_audit_logs', {
        id: { type: 'text', primaryKey: true },
        actor_user_id: { type: 'text', notNull: true },
        target_user_id: { type: 'text', notNull: true },
        role: { type: 'text', notNull: true },
        hub_id: { type: 'text' },
        server_id: { type: 'text' },
        channel_id: { type: 'text' },
        outcome: { type: 'text', notNull: true },
        reason: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 9. space_admin_assignments
    pgm.createTable('space_admin_assignments', {
        id: { type: 'text', primaryKey: true },
        hub_id: { type: 'text', notNull: true, references: 'hubs', onDelete: 'CASCADE' },
        server_id: { type: 'text', notNull: true, references: 'servers', onDelete: 'CASCADE' },
        assigned_user_id: { type: 'text', notNull: true },
        assigned_by_user_id: { type: 'text', notNull: true },
        status: { type: 'text', notNull: true, default: 'active' },
        expires_at: { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, {
        ifNotExists: true,
        constraints: {
            unique: [['server_id', 'assigned_user_id']]
        }
    });

    // 10. delegation_audit_events
    pgm.createTable('delegation_audit_events', {
        id: { type: 'text', primaryKey: true },
        action_type: { type: 'text', notNull: true },
        actor_user_id: { type: 'text', notNull: true },
        target_user_id: { type: 'text' },
        assignment_id: { type: 'text', references: 'space_admin_assignments', onDelete: 'SET NULL' },
        hub_id: { type: 'text', references: 'hubs', onDelete: 'SET NULL' },
        server_id: { type: 'text', references: 'servers', onDelete: 'SET NULL' },
        metadata: { type: 'jsonb', notNull: true, default: '{}' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 11. moderation_actions
    pgm.createTable('moderation_actions', {
        id: { type: 'text', primaryKey: true },
        action_type: { type: 'text', notNull: true },
        actor_user_id: { type: 'text', notNull: true },
        server_id: { type: 'text', notNull: true },
        channel_id: { type: 'text' },
        target_user_id: { type: 'text' },
        target_message_id: { type: 'text' },
        reason: { type: 'text', notNull: true },
        metadata: { type: 'jsonb', notNull: true, default: '{}' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 12. moderation_reports
    pgm.createTable('moderation_reports', {
        id: { type: 'text', primaryKey: true },
        server_id: { type: 'text', notNull: true },
        channel_id: { type: 'text' },
        reporter_user_id: { type: 'text', notNull: true },
        target_user_id: { type: 'text' },
        target_message_id: { type: 'text' },
        reason: { type: 'text', notNull: true },
        status: { type: 'text', notNull: true },
        triaged_by_user_id: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 13. chat_messages
    pgm.createTable('chat_messages', {
        id: { type: 'text', primaryKey: true },
        channel_id: { type: 'text', notNull: true, references: 'channels', onDelete: 'CASCADE' },
        author_user_id: { type: 'text', notNull: true },
        author_display_name: { type: 'text', notNull: true, default: 'Unknown' },
        content: { type: 'text', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 14. channel_read_states
    pgm.createTable('channel_read_states', {
        product_user_id: { type: 'text', notNull: true, primaryKey: true },
        channel_id: { type: 'text', notNull: true, references: 'channels', onDelete: 'CASCADE', primaryKey: true },
        last_read_at: { type: 'timestamptz', notNull: true },
        is_muted: { type: 'boolean', notNull: true, default: false },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 15. mention_markers
    pgm.createTable('mention_markers', {
        id: { type: 'text', primaryKey: true },
        channel_id: { type: 'text', notNull: true, references: 'channels', onDelete: 'CASCADE' },
        message_id: { type: 'text', notNull: true, references: 'chat_messages', onDelete: 'CASCADE' },
        mentioned_user_id: { type: 'text', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 16. voice_presence
    pgm.createTable('voice_presence', {
        channel_id: { type: 'text', notNull: true, references: 'channels', onDelete: 'CASCADE', primaryKey: true },
        product_user_id: { type: 'text', notNull: true, primaryKey: true },
        muted: { type: 'boolean', notNull: true, default: false },
        deafened: { type: 'boolean', notNull: true, default: false },
        video_enabled: { type: 'boolean', notNull: true, default: false },
        video_quality: { type: 'text', notNull: true, default: 'medium' },
        joined_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 17. hub_federation_policies
    pgm.createTable('hub_federation_policies', {
        hub_id: { type: 'text', primaryKey: true, references: 'hubs', onDelete: 'CASCADE' },
        allowlist: { type: 'text[]', notNull: true, default: '{}' },
        created_by_user_id: { type: 'text', notNull: true },
        updated_by_user_id: { type: 'text', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 18. federation_policy_events
    pgm.createTable('federation_policy_events', {
        id: { type: 'text', primaryKey: true },
        hub_id: { type: 'text', notNull: true, references: 'hubs', onDelete: 'CASCADE' },
        actor_user_id: { type: 'text', notNull: true },
        action_type: { type: 'text', notNull: true },
        policy_json: { type: 'jsonb', notNull: true, default: '{}' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 19. room_acl_status
    pgm.createTable('room_acl_status', {
        room_id: { type: 'text', primaryKey: true },
        hub_id: { type: 'text', notNull: true, references: 'hubs', onDelete: 'CASCADE' },
        server_id: { type: 'text', references: 'servers', onDelete: 'CASCADE' },
        channel_id: { type: 'text', references: 'channels', onDelete: 'CASCADE' },
        room_kind: { type: 'text', notNull: true },
        allowlist: { type: 'text[]', notNull: true, default: '{}' },
        status: { type: 'text', notNull: true },
        last_error: { type: 'text' },
        applied_at: { type: 'timestamptz' },
        checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 20. discord_bridge_connections
    pgm.createTable('discord_bridge_connections', {
        id: { type: 'text', primaryKey: true },
        server_id: { type: 'text', notNull: true, references: 'servers', onDelete: 'CASCADE', unique: true },
        connected_by_user_id: { type: 'text', notNull: true },
        discord_user_id: { type: 'text' },
        discord_username: { type: 'text' },
        access_token: { type: 'text' },
        refresh_token: { type: 'text' },
        token_expires_at: { type: 'timestamptz' },
        guild_id: { type: 'text' },
        guild_name: { type: 'text' },
        status: { type: 'text', notNull: true, default: 'disconnected' },
        last_sync_at: { type: 'timestamptz' },
        last_error: { type: 'text' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, { ifNotExists: true });

    // 21. discord_bridge_channel_mappings
    pgm.createTable('discord_bridge_channel_mappings', {
        id: { type: 'text', primaryKey: true },
        server_id: { type: 'text', notNull: true, references: 'servers', onDelete: 'CASCADE' },
        guild_id: { type: 'text', notNull: true },
        discord_channel_id: { type: 'text', notNull: true },
        discord_channel_name: { type: 'text', notNull: true },
        matrix_channel_id: { type: 'text', notNull: true, references: 'channels', onDelete: 'CASCADE' },
        enabled: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    }, {
        ifNotExists: true,
        constraints: {
            unique: [['server_id', 'discord_channel_id'], ['server_id', 'matrix_channel_id']]
        }
    });

    // 22. platform_settings
    pgm.createTable('platform_settings', {
        id: { type: 'text', primaryKey: true },
        bootstrap_completed_at: { type: 'timestamptz' },
        bootstrap_admin_user_id: { type: 'text' },
        bootstrap_hub_id: { type: 'text' },
        default_server_id: { type: 'text' },
        default_channel_id: { type: 'text' },
    }, { ifNotExists: true });
};

export const down = (pgm) => {
    pgm.dropTable('platform_settings');
    pgm.dropTable('discord_bridge_channel_mappings');
    pgm.dropTable('discord_bridge_connections');
    pgm.dropTable('room_acl_status');
    pgm.dropTable('federation_policy_events');
    pgm.dropTable('hub_federation_policies');
    pgm.dropTable('voice_presence');
    pgm.dropTable('mention_markers');
    pgm.dropTable('channel_read_states');
    pgm.dropTable('chat_messages');
    pgm.dropTable('moderation_reports');
    pgm.dropTable('moderation_actions');
    pgm.dropTable('delegation_audit_events');
    pgm.dropTable('space_admin_assignments');
    pgm.dropTable('role_assignment_audit_logs');
    pgm.dropTable('role_bindings');
    pgm.dropTable('idempotency_keys');
    pgm.dropTable('channels');
    pgm.dropTable('categories');
    pgm.dropTable('servers');
    pgm.dropTable('hubs');
    pgm.dropTable('identity_mappings');
};
