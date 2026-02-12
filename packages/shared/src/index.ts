export type Role = "hub_operator" | "creator_admin" | "creator_moderator" | "member";

export type ChannelType = "text" | "voice" | "announcement";

export interface ServerBlueprint {
  serverName: string;
  defaultChannels: Array<{
    name: string;
    type: ChannelType;
  }>;
}

export const DEFAULT_SERVER_BLUEPRINT: ServerBlueprint = {
  serverName: "New Creator Server",
  defaultChannels: [
    { name: "announcements", type: "announcement" },
    { name: "general", type: "text" },
    { name: "voice-lounge", type: "voice" }
  ]
};
