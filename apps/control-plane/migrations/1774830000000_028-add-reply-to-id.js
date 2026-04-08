export const up = (pgm) => {
  pgm.addColumn("chat_messages", {
    reply_to_id: { 
      type: "text", 
      notNull: false, 
      references: "chat_messages(id)", 
      onDelete: "SET NULL" 
    },
  });
  pgm.createIndex("chat_messages", "reply_to_id");
};

export const down = (pgm) => {
  pgm.dropIndex("chat_messages", "reply_to_id");
  pgm.dropColumn("chat_messages", "reply_to_id");
};
