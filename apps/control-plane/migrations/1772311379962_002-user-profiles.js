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
    pgm.addColumns('identity_mappings', {
        display_name: { type: 'text' },
        bio: { type: 'text' },
        custom_status: { type: 'text' },
    });
};

export const down = (pgm) => {
    pgm.dropColumns('identity_mappings', ['display_name', 'bio', 'custom_status']);
};
