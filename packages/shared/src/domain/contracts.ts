export type Role = "hub_operator" | "creator_admin" | "creator_moderator" | "member";

export type ChannelType = "text" | "voice" | "announcement";

export type ModerationActionType =
  | "kick"
  | "ban"
  | "unban"
  | "timeout"
  | "redact_message"
  | "lock_channel"
  | "unlock_channel"
  | "set_slow_mode"
  | "set_posting_restrictions";

export type ReportStatus = "open" | "triaged" | "resolved" | "dismissed";

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
  isLocked: boolean;
  slowModeSeconds: number;
  postingRestrictedToRoles: Role[];
  voiceMetadata: VoiceMetadata | null;
  createdAt: string;
}

export interface VoiceMetadata {
  sfuRoomId: string;
  maxParticipants: number;
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

export interface ModerationAction {
  id: string;
  actionType: ModerationActionType;
  actorUserId: string;
  serverId: string;
  channelId: string | null;
  targetUserId: string | null;
  targetMessageId: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ModerationReport {
  id: string;
  serverId: string;
  channelId: string | null;
  reporterUserId: string;
  targetUserId: string | null;
  targetMessageId: string | null;
  reason: string;
  status: ReportStatus;
  triagedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceTokenGrant {
  channelId: string;
  serverId: string;
  sfuRoomId: string;
  participantUserId: string;
  token: string;
  expiresAt: string;
}

export const DEFAULT_SERVER_BLUEPRINT: ServerBlueprint = {
  serverName: "New Creator Server",
  defaultChannels: [
    { name: "announcements", type: "announcement" },
    { name: "general", type: "text" },
    { name: "voice-lounge", type: "voice" }
  ]
};
