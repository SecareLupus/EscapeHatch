export const up = (pgm) => {
  pgm.addColumn("channels", {
    icon_url: { type: "text", notNull: false },
  });
};

export const down = (pgm) => {
  pgm.dropColumn("channels", "icon_url");
};
