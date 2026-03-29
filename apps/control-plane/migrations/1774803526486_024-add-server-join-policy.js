/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.addColumn('servers', {
        join_policy: { type: 'text', notNull: true, default: 'open' },
    });
};

export const down = (pgm) => {
    pgm.dropColumn('servers', 'join_policy');
};
