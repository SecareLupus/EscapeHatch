import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireInitialized } from "../auth/middleware.js";
import { canManageHub } from "../services/policy-service.js";
import {
  createHubInvite,
  getHubInvite,
  useHubInvite
} from "../services/chat-service.js";

export async function registerInviteRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireAuth, requireInitialized] };

  app.post("/v1/hubs/:hubId/invites", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const payload = z.object({
      expiresAt: z.string().datetime().optional(),
      maxUses: z.number().int().min(1).optional()
    }).parse(request.body ?? {});

    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    const invite = await createHubInvite({
      hubId: params.hubId,
      createdByUserId: request.auth!.productUserId,
      expiresAt: payload.expiresAt,
      maxUses: payload.maxUses
    });

    reply.code(201);
    return invite;
  });

  app.get("/v1/invites/:inviteId", async (request, reply) => {
    const params = z.object({ inviteId: z.string().min(1) }).parse(request.params);
    const invite = await getHubInvite(params.inviteId);
    if (!invite) {
      reply.code(404).send({ message: "Invite not found." });
      return;
    }
    return invite;
  });

  app.post("/v1/invites/:inviteId/join", initializedAuthHandlers, async (request) => {
    const params = z.object({ inviteId: z.string().min(1) }).parse(request.params);
    return useHubInvite({
      inviteId: params.inviteId,
      productUserId: request.auth!.productUserId
    });
  });
}
