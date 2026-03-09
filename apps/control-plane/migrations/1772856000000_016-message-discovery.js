export const up = (pgm) => {
    // Enable pg_trgm for fuzzy matching and trigram search
    pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // Create a GIN index on chat_messages.content for efficient trigram search
    pgm.sql('CREATE INDEX idx_messages_content_trgm ON chat_messages USING gin (content gin_trgm_ops) WHERE deleted_at IS NULL');
};

export const down = (pgm) => {
    pgm.sql('DROP INDEX idx_messages_content_trgm');
};
