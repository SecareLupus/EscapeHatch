import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireInitialized } from "../auth/middleware.js";
import { isActionAllowed } from "../services/policy-service.js";
import {
  listTrustedHubs,
  addTrustedHub,
  removeTrustedHub
} from "../services/federation-service.js";

export async function registerFederationRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireAuth, requireInitialized] };

  app.get("/v1/admin/federation/trust", initializedAuthHandlers, async (request, reply) => {
    const isAdmin = await isActionAllowed({
      productUserId: request.auth!.productUserId,
      action: "hub.suspend",
      scope: { hubId: "*" } // Match any hub for global admin check
    });
    if (!isAdmin) {
      reply.code(403).send({ message: "Forbidden: hub admin access required." });
      return;
    }
    const items = await listTrustedHubs();
    return { items };
  });

  app.post("/v1/admin/federation/trust", initializedAuthHandlers, async (request, reply) => {
    const isAdmin = await isActionAllowed({
      productUserId: request.auth!.productUserId,
      action: "hub.suspend",
      scope: { hubId: "*" }
    });
    if (!isAdmin) {
      reply.code(403).send({ message: "Forbidden: hub admin access required." });
      return;
    }
    const payload = z.object({
      hubUrl: z.string().url(),
      sharedSecret: z.string().min(16),
      trustLevel: z.enum(["guest", "member", "partner"]).optional(),
      metadata: z.record(z.any()).optional()
    }).parse(request.body);

    const hub = await addTrustedHub(payload);
    reply.code(201);
    return hub;
  });

  app.delete("/v1/admin/federation/trust/:hubUrl", initializedAuthHandlers, async (request, reply) => {
    const isAdmin = await isActionAllowed({
      productUserId: request.auth!.productUserId,
      action: "hub.suspend",
      scope: { hubId: "*" }
    });
    if (!isAdmin) {
      reply.code(403).send({ message: "Forbidden: hub admin access required." });
      return;
    }
    const params = z.object({ hubUrl: z.string() }).parse(request.params);
    await removeTrustedHub(decodeURIComponent(params.hubUrl));
    reply.code(204).send();
  });
}
