import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireInitialized } from "../auth/middleware.js";
import { getAnnouncementFeed } from "../services/chat-service.js";
import {
  followAnnouncement,
  unfollowAnnouncement,
  listFollowedAnnouncements
} from "../services/extension-service.js";

export async function registerAnnouncementRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireAuth, requireInitialized] };

  app.get("/v1/announcements/feed", initializedAuthHandlers, async (request) => {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse((request.query as any).limit);
    const productUserId = request.auth!.productUserId;
    const items = await getAnnouncementFeed(productUserId, limit);
    return { items };
  });

  app.post("/v1/announcements/follow/:serverId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    await followAnnouncement(request.auth!.productUserId, params.serverId);
    reply.code(204).send();
  });

  app.delete("/v1/announcements/follow/:serverId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    await unfollowAnnouncement(request.auth!.productUserId, params.serverId);
    reply.code(204).send();
  });

  app.get("/v1/announcements/followed", initializedAuthHandlers, async (request) => {
    const items = await listFollowedAnnouncements(request.auth!.productUserId);
    return { items };
  });
}
