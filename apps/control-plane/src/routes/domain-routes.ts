import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_SERVER_BLUEPRINT } from "@escapehatch/shared";
import { requireAuth, requireInitialized } from "../auth/middleware.js";
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
import { createMessage, listChannels, listMessages, listServers } from "../services/chat-service.js";
import { getBootstrapStatus } from "../services/bootstrap-service.js";

export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireInitialized, requireAuth] };

  app.get("/health", async () => {
    return { status: "ok", service: "control-plane" };
  });

  app.get("/bootstrap/default-server", async () => {
    return DEFAULT_SERVER_BLUEPRINT;
  });

  app.post("/v1/servers", initializedAuthHandlers, async (request, reply) => {
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

  app.get("/v1/bootstrap/context", initializedAuthHandlers, async () => {
    const status = await getBootstrapStatus();
    return {
      hubId: status.bootstrapHubId,
      defaultServerId: status.defaultServerId,
      defaultChannelId: status.defaultChannelId
    };
  });

  app.get("/v1/servers", initializedAuthHandlers, async () => {
    return { items: await listServers() };
  });

  app.post("/v1/channels", initializedAuthHandlers, async (request, reply) => {
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

  app.get("/v1/servers/:serverId/channels", initializedAuthHandlers, async (request) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    return { items: await listChannels(params.serverId) };
  });

  app.get("/v1/channels/:channelId/messages", initializedAuthHandlers, async (request) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const query = z
      .object({
        before: z.string().datetime().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50)
      })
      .parse(request.query);

    return {
      items: await listMessages({
        channelId: params.channelId,
        before: query.before,
        limit: query.limit
      })
    };
  });

  app.post("/v1/channels/:channelId/messages", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        content: z.string().trim().min(1).max(2000)
      })
      .parse(request.body);

    const message = await createMessage({
      channelId: params.channelId,
      actorUserId: request.auth!.productUserId,
      content: payload.content
    });

    reply.code(201);
    return message;
  });

  app.post("/v1/roles/grant", initializedAuthHandlers, async (request, reply) => {
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

  app.post("/v1/moderation/actions", initializedAuthHandlers, async (request, reply) => {
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

  app.patch("/v1/channels/:channelId/controls", initializedAuthHandlers, async (request, reply) => {
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

  app.post("/v1/reports", initializedAuthHandlers, async (request, reply) => {
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

  app.patch("/v1/reports/:reportId", initializedAuthHandlers, async (request) => {
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

  app.get("/v1/audit-logs", initializedAuthHandlers, async (request) => {
    const query = z.object({ serverId: z.string().min(1) }).parse(request.query);
    return { items: await listAuditLogs(query.serverId) };
  });

  app.post("/v1/voice/token", initializedAuthHandlers, async (request) => {
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
