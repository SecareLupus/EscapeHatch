import type { ModerationActionType, ReportStatus } from "./contracts.js";

export interface ModerationAuditEvent {
  eventId: string;
  actionType: ModerationActionType;
  actorUserId: string;
  scope: {
    hubId?: string;
    serverId: string;
    channelId?: string;
  };
  target: {
    userId?: string;
    messageId?: string;
  };
  reason: string;
  timestamp: string;
}

export interface ModerationReportEvent {
  eventId: string;
  reportId: string;
  serverId: string;
  status: ReportStatus;
  actorUserId: string;
  timestamp: string;
}
