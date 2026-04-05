import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireInitialized } from "../auth/middleware.js";
import {
  issueVoiceToken
} from "../services/voice-service.js";
import {
  listVoicePresence,
  joinVoicePresence,
  updateVoicePresenceState,
  leaveVoicePresence
} from "../services/voice-presence-service.js";

export async function registerVoiceRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireAuth, requireInitialized] };

  app.post("/v1/voice/token", initializedAuthHandlers, async (request) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1),
        videoQuality: z.enum(["low", "medium", "high"]).optional()
      })
      .parse(request.body);

    return issueVoiceToken({
      actorUserId: request.auth!.productUserId,
      ...payload
    });
  });

  app.get("/v1/voice/presence", initializedAuthHandlers, async (request) => {
    const query = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1)
      })
      .parse(request.query);

    return {
      items: await listVoicePresence({
        serverId: query.serverId,
        channelId: query.channelId
      })
    };
  });

  app.post("/v1/voice/presence/join", initializedAuthHandlers, async (request, reply) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1),
        muted: z.boolean().optional(),
        deafened: z.boolean().optional(),
        videoEnabled: z.boolean().optional(),
        videoQuality: z.enum(["low", "medium", "high"]).optional()
      })
      .parse(request.body);
    await joinVoicePresence({
      productUserId: request.auth!.productUserId,
      ...payload
    });
    reply.code(204).send();
  });

  app.patch("/v1/voice/presence/state", initializedAuthHandlers, async (request, reply) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1),
        muted: z.boolean(),
        deafened: z.boolean(),
        videoEnabled: z.boolean().optional(),
        videoQuality: z.enum(["low", "medium", "high"]).optional()
      })
      .parse(request.body);
    await updateVoicePresenceState({
      productUserId: request.auth!.productUserId,
      ...payload
    });
    reply.code(204).send();
  });

  app.post("/v1/voice/presence/leave", initializedAuthHandlers, async (request, reply) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1)
      })
      .parse(request.body);
    await leaveVoicePresence({
      productUserId: request.auth!.productUserId,
      ...payload
    });
    reply.code(204).send();
  });
}
