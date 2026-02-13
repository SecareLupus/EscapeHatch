import crypto from "node:crypto";
import type { VoiceTokenGrant } from "@escapehatch/shared";
import { withDb } from "../db/client.js";
import { executePrivilegedAction } from "./privileged-gateway.js";
import { config } from "../config.js";

function signEphemeralToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = process.env.SFU_TOKEN_SECRET ?? "dev-sfu-secret";
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export async function issueVoiceToken(input: {
  actorUserId: string;
  serverId: string;
  channelId: string;
  videoQuality?: "low" | "medium" | "high";
}): Promise<VoiceTokenGrant> {
  return executePrivilegedAction({
    actorUserId: input.actorUserId,
    action: "voice.token.issue",
    scope: { serverId: input.serverId, channelId: input.channelId },
    reason: "voice_session_join",
    run: async () => {
      const channel = await withDb(async (db) => {
        const row = await db.query<{
          server_id: string;
          voice_sfu_room_id: string | null;
          type: string;
        }>(
          "select server_id, voice_sfu_room_id, type from channels where id = $1 and server_id = $2 limit 1",
          [input.channelId, input.serverId]
        );

        return row.rows[0];
      });

      if (!channel || channel.type !== "voice" || !channel.voice_sfu_room_id) {
        throw new Error("Channel is not configured as a voice channel.");
      }

      const ttlSeconds = Math.max(60, config.voice.tokenTtlSeconds);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const token = signEphemeralToken({
        sub: input.actorUserId,
        room: channel.voice_sfu_room_id,
        video_quality: input.videoQuality ?? "medium",
        exp: Math.floor(expiresAt.getTime() / 1000)
      });

      return {
        channelId: input.channelId,
        serverId: input.serverId,
        sfuRoomId: channel.voice_sfu_room_id,
        participantUserId: input.actorUserId,
        token,
        expiresAt: expiresAt.toISOString()
      };
    }
  });
}
