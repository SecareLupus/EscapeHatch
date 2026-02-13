import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_SERVER_BLUEPRINT } from "@escapehatch/shared";
import { requireAuth } from "../auth/middleware.js";
import { createChannelWorkflow, createServerWorkflow } from "../services/provisioning-service.js";
import {
  createReport,
  listAuditLogs,
  performModerationAction,
  setChannelControls,
  transitionReportStatus
} from "../services/moderation-service.js";
import { issueVoiceToken } from "../services/voice-service.js";
import { grantRole } from "../services/policy-service.js";

export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return { status: "ok", service: "control-plane" };
  });

  app.get("/bootstrap/default-server", async () => {
    return DEFAULT_SERVER_BLUEPRINT;
  });

  app.post("/v1/servers", { preHandler: requireAuth }, async (request, reply) => {
    const payload = z
      .object({
        hubId: z.string().min(1),
        name: z.string().min(2).max(80)
      })
      .parse(request.body);

    const idempotencyKey = request.headers["idempotency-key"];
    const server = await createServerWorkflow({
      ...payload,
      productUserId: request.auth!.productUserId,
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined
    });

    reply.code(201);
    return server;
  });

  app.post("/v1/channels", { preHandler: requireAuth }, async (request, reply) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        categoryId: z.string().optional(),
        name: z.string().min(2).max(80),
        type: z.enum(["text", "voice", "announcement"])
      })
      .parse(request.body);

    const idempotencyKey = request.headers["idempotency-key"];
    const channel = await createChannelWorkflow({
      ...payload,
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined
    });

    reply.code(201);
    return channel;
  });

  app.post("/v1/roles/grant", { preHandler: requireAuth }, async (request, reply) => {
    const payload = z
      .object({
        productUserId: z.string().min(1),
        role: z.enum(["hub_operator", "creator_admin", "creator_moderator", "member"]),
        hubId: z.string().optional(),
        serverId: z.string().optional(),
        channelId: z.string().optional()
      })
      .parse(request.body);

    await grantRole(payload);
    reply.code(204).send();
  });

  app.post("/v1/moderation/actions", { preHandler: requireAuth }, async (request, reply) => {
    const payload = z
      .object({
        action: z.enum(["kick", "ban", "unban", "timeout", "redact_message"]),
        serverId: z.string().min(1),
        channelId: z.string().optional(),
        targetUserId: z.string().optional(),
        targetMessageId: z.string().optional(),
        timeoutSeconds: z.number().int().positive().optional(),
        reason: z.string().min(3)
      })
      .parse(request.body);

    await performModerationAction({ ...payload, actorUserId: request.auth!.productUserId });
    reply.code(204).send();
  });

  app.patch("/v1/channels/:channelId/controls", { preHandler: requireAuth }, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        serverId: z.string().min(1),
        lock: z.boolean().optional(),
        slowModeSeconds: z.number().int().min(0).max(600).optional(),
        postingRestrictedToRoles: z
          .array(z.enum(["hub_operator", "creator_admin", "creator_moderator", "member"]))
          .optional(),
        reason: z.string().min(3)
      })
      .parse(request.body);

    await setChannelControls({
      actorUserId: request.auth!.productUserId,
      channelId: params.channelId,
      ...payload
    });

    reply.code(204).send();
  });

  app.post("/v1/reports", { preHandler: requireAuth }, async (request, reply) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().optional(),
        targetUserId: z.string().optional(),
        targetMessageId: z.string().optional(),
        reason: z.string().min(3)
      })
      .parse(request.body);

    const report = await createReport({ ...payload, reporterUserId: request.auth!.productUserId });
    reply.code(201);
    return report;
  });

  app.patch("/v1/reports/:reportId", { preHandler: requireAuth }, async (request) => {
    const params = z.object({ reportId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        serverId: z.string().min(1),
        status: z.enum(["triaged", "resolved", "dismissed"]),
        reason: z.string().min(3)
      })
      .parse(request.body);

    return transitionReportStatus({
      actorUserId: request.auth!.productUserId,
      reportId: params.reportId,
      ...payload
    });
  });

  app.get("/v1/audit-logs", { preHandler: requireAuth }, async (request) => {
    const query = z.object({ serverId: z.string().min(1) }).parse(request.query);
    return { items: await listAuditLogs(query.serverId) };
  });

  app.post("/v1/voice/token", { preHandler: requireAuth }, async (request) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1)
      })
      .parse(request.body);

    return issueVoiceToken({
      actorUserId: request.auth!.productUserId,
      ...payload
    });
  });
}
