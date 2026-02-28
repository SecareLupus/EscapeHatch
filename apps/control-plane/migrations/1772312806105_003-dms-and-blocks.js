/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    // 1. Add type to servers
    pgm.addColumn('servers', {
        type: { type: 'text', notNull: true, default: 'default' },
    });

    // 2. Create channel_members table for private DM visibility
    pgm.createTable('channel_members', {
        channel_id: { type: 'text', notNull: true, references: 'channels', onDelete: 'CASCADE' },
        product_user_id: { type: 'text', notNull: true },
        joined_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.addConstraint('channel_members', 'channel_members_pkey', {
        primaryKey: ['channel_id', 'product_user_id'],
    });

    // 3. Create user_blocks table
    pgm.createTable('user_blocks', {
        blocker_user_id: { type: 'text', notNull: true },
        blocked_user_id: { type: 'text', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.addConstraint('user_blocks', 'user_blocks_pkey', {
        primaryKey: ['blocker_user_id', 'blocked_user_id'],
    });
};

export const down = (pgm) => {
    pgm.dropTable('user_blocks');
    pgm.dropTable('channel_members');
    pgm.dropColumn('servers', 'type');
};
