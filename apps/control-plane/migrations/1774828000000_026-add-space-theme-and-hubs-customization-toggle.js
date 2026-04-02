/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.addColumn('servers', {
        theme: { type: 'jsonb', notNull: false },
    });
    pgm.addColumn('hubs', {
        allow_space_customization: { type: 'boolean', notNull: true, default: true },
    });
};

export const down = (pgm) => {
    pgm.dropColumn('servers', 'theme');
    pgm.dropColumn('hubs', 'allow_space_customization');
};
