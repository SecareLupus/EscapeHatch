export type Role = "hub_operator" | "creator_admin" | "creator_moderator" | "member";

export type ChannelType = "text" | "voice" | "announcement";

export interface ServerBlueprint {
  serverName: string;
  defaultChannels: Array<{
    name: string;
    type: ChannelType;
  }>;
}

export interface Hub {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
}

export interface Server {
  id: string;
  hubId: string;
  name: string;
  matrixSpaceId: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface Category {
  id: string;
  serverId: string;
  name: string;
  matrixSubspaceId: string | null;
  createdAt: string;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  matrixRoomId: string | null;
  createdAt: string;
}

export interface MatrixProvisioningDefaults {
  joinRule: "invite" | "public";
  historyVisibility: "joined" | "invited" | "shared" | "world_readable";
}

export interface CreateServerRequest {
  hubId: string;
  name: string;
  idempotencyKey?: string;
}

export interface CreateChannelRequest {
  serverId: string;
  categoryId?: string;
  name: string;
  type: ChannelType;
  idempotencyKey?: string;
}

export const DEFAULT_SERVER_BLUEPRINT: ServerBlueprint = {
  serverName: "New Creator Server",
  defaultChannels: [
    { name: "announcements", type: "announcement" },
    { name: "general", type: "text" },
    { name: "voice-lounge", type: "voice" }
  ]
};
