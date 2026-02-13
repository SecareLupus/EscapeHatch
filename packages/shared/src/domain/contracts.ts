export type Role = "hub_admin" | "space_owner" | "space_moderator" | "user";

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
  ownerUserId: string;
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
  videoEnabled?: boolean;
  maxVideoParticipants?: number | null;
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

export interface VoicePresenceMember {
  channelId: string;
  serverId: string;
  userId: string;
  displayName: string;
  muted: boolean;
  deafened: boolean;
  videoEnabled: boolean;
  videoQuality: "low" | "medium" | "high";
  joinedAt: string;
  updatedAt: string;
}

export interface HubFederationPolicy {
  hubId: string;
  allowlist: string[];
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FederationPolicyEvent {
  id: string;
  hubId: string;
  actorUserId: string;
  actionType: "policy_updated" | "policy_reconciled";
  policy: {
    allowlist: string[];
  };
  createdAt: string;
}

export interface FederationPolicyStatus {
  roomId: string;
  hubId: string;
  serverId: string | null;
  channelId: string | null;
  roomKind: "space" | "room";
  allowlist: string[];
  status: "applied" | "skipped" | "error";
  lastError: string | null;
  appliedAt: string | null;
  checkedAt: string;
  updatedAt: string;
}

export interface DiscordBridgeConnection {
  id: string;
  hubId: string;
  connectedByUserId: string;
  guildId: string | null;
  guildName: string | null;
  status: "disconnected" | "connected" | "degraded" | "syncing";
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface DiscordBridgeChannelMapping {
  id: string;
  hubId: string;
  guildId: string;
  discordChannelId: string;
  discordChannelName: string;
  matrixChannelId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DelegationAssignmentStatus = "active" | "revoked" | "expired";

export interface SpaceOwnerAssignment {
  id: string;
  hubId: string;
  serverId: string;
  assignedUserId: string;
  assignedByUserId: string;
  status: DelegationAssignmentStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DelegationAuditEvent {
  id: string;
  actionType:
    | "space_owner_assigned"
    | "space_owner_revoked"
    | "space_owner_transfer_started"
    | "space_owner_transfer_completed";
  actorUserId: string;
  targetUserId: string | null;
  assignmentId: string | null;
  hubId: string | null;
  serverId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ChannelReadState {
  channelId: string;
  userId: string;
  lastReadAt: string;
  updatedAt: string;
}

export interface MentionMarker {
  id: string;
  channelId: string;
  messageId: string;
  mentionedUserId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorUserId: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
}

export const DEFAULT_SERVER_BLUEPRINT: ServerBlueprint = {
  serverName: "New Creator Server",
  defaultChannels: [
    { name: "announcements", type: "announcement" },
    { name: "general", type: "text" },
    { name: "voice-lounge", type: "voice" }
  ]
};
