export const up = (pgm) => {
    // Add attachments and edit/delete support to chat_messages
    pgm.addColumns('chat_messages', {
        attachments: { type: 'jsonb', notNull: true, default: '[]' },
        updated_at: { type: 'timestamptz' },
        deleted_at: { type: 'timestamptz' }
    });

    // Create message_reactions table
    pgm.createTable('message_reactions', {
        id: { type: 'text', primaryKey: true },
        message_id: { type: 'text', notNull: true, references: 'chat_messages', onDelete: 'CASCADE' },
        user_id: { type: 'text', notNull: true },
        emoji: { type: 'text', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.addConstraint('message_reactions', 'message_reactions_message_id_user_id_emoji_unique', {
        unique: ['message_id', 'user_id', 'emoji'],
    });
};

export const down = (pgm) => {
    pgm.dropTable('message_reactions');
    pgm.dropColumns('chat_messages', ['attachments', 'updated_at', 'deleted_at']);
};
