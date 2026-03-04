export const up = (pgm) => {
    pgm.addColumns('chat_messages', {
        is_relay: { type: 'boolean', notNull: true, default: false }
    });
};

export const down = (pgm) => {
    pgm.dropColumns('chat_messages', ['is_relay']);
};
