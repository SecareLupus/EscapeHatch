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
import {
  canManageHub,
  canManageServer,
  grantRole,
  listAllowedActions,
  listRoleBindings
} from "../services/policy-service.js";
import {
  createCategory,
  createMessage,
  deleteChannel,
  deleteServer,
  listCategories,
  listChannels,
  listMessages,
  listServers,
  moveChannelToCategory,
  renameCategory,
  renameChannel,
  renameServer
} from "../services/chat-service.js";
import { getBootstrapStatus } from "../services/bootstrap-service.js";
import { publishChannelMessage, subscribeToChannelMessages } from "../services/chat-realtime.js";
import { listHubsForUser } from "../services/hub-service.js";

export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireAuth, requireInitialized] };

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

    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: payload.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

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

  app.get("/v1/hubs", initializedAuthHandlers, async (request) => {
    return { items: await listHubsForUser(request.auth!.productUserId) };
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

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: payload.serverId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient server management scope." });
      return;
    }

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

  app.get("/v1/servers/:serverId/categories", initializedAuthHandlers, async (request) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    return { items: await listCategories(params.serverId) };
  });

  app.patch("/v1/servers/:serverId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    const payload = z.object({ name: z.string().min(2).max(80) }).parse(request.body);

    const serverRows = await listServers();
    const server = serverRows.find((item) => item.id === params.serverId);
    if (!server) {
      reply.code(404).send({ message: "Server not found." });
      return;
    }

    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: server.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    return renameServer({
      serverId: params.serverId,
      name: payload.name
    });
  });

  app.delete("/v1/servers/:serverId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);

    const serverRows = await listServers();
    const server = serverRows.find((item) => item.id === params.serverId);
    if (!server) {
      reply.code(404).send({ message: "Server not found." });
      return;
    }

    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: server.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    await deleteServer(params.serverId);
    reply.code(204).send();
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
    publishChannelMessage(message);

    reply.code(201);
    return message;
  });

  app.post("/v1/categories", initializedAuthHandlers, async (request, reply) => {
    const payload = z
      .object({
        serverId: z.string().min(1),
        name: z.string().min(2).max(80)
      })
      .parse(request.body);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: payload.serverId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient server management scope." });
      return;
    }

    const category = await createCategory(payload);
    reply.code(201);
    return category;
  });

  app.patch("/v1/categories/:categoryId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ categoryId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        serverId: z.string().min(1),
        name: z.string().min(2).max(80)
      })
      .parse(request.body);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: payload.serverId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient server management scope." });
      return;
    }

    try {
      return await renameCategory({
        categoryId: params.categoryId,
        serverId: payload.serverId,
        name: payload.name
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Category not found.") {
        reply.code(404).send({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.patch("/v1/channels/:channelId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        serverId: z.string().min(1),
        name: z.string().min(2).max(80)
      })
      .parse(request.body);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: payload.serverId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient server management scope." });
      return;
    }

    const channels = await listChannels(payload.serverId);
    const existing = channels.find((channel) => channel.id === params.channelId);
    if (!existing) {
      reply.code(404).send({ message: "Channel not found." });
      return;
    }

    return renameChannel({
      channelId: params.channelId,
      serverId: payload.serverId,
      name: payload.name
    });
  });

  app.patch("/v1/channels/:channelId/category", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        serverId: z.string().min(1),
        categoryId: z.string().min(1).nullable()
      })
      .parse(request.body);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: payload.serverId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient server management scope." });
      return;
    }

    try {
      return await moveChannelToCategory({
        channelId: params.channelId,
        serverId: payload.serverId,
        categoryId: payload.categoryId
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "Category not found for server." || error.message === "Channel not found.")
      ) {
        reply.code(404).send({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete("/v1/channels/:channelId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const query = z.object({ serverId: z.string().min(1) }).parse(request.query);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: query.serverId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient server management scope." });
      return;
    }

    const channels = await listChannels(query.serverId);
    const existing = channels.find((channel) => channel.id === params.channelId);
    if (!existing) {
      reply.code(404).send({ message: "Channel not found." });
      return;
    }

    await deleteChannel({
      channelId: params.channelId,
      serverId: query.serverId
    });
    reply.code(204).send();
  });

  app.get("/v1/channels/:channelId/stream", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    const writeEvent = (event: string, payload: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent("ready", {
      channelId: params.channelId,
      connectedAt: new Date().toISOString()
    });

    const unsubscribe = subscribeToChannelMessages(params.channelId, (message) => {
      writeEvent("message.created", message);
    });

    const keepAliveTimer = setInterval(() => {
      writeEvent("ping", { at: Date.now() });
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(keepAliveTimer);
      unsubscribe();
      reply.raw.end();
    });
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

  app.get("/v1/me/roles", initializedAuthHandlers, async (request) => {
    return {
      items: await listRoleBindings({
        productUserId: request.auth!.productUserId
      })
    };
  });

  app.get("/v1/permissions", initializedAuthHandlers, async (request) => {
    const query = z
      .object({
        serverId: z.string().min(1),
        channelId: z.string().min(1).optional()
      })
      .parse(request.query);

    return {
      items: await listAllowedActions({
        productUserId: request.auth!.productUserId,
        scope: {
          serverId: query.serverId,
          channelId: query.channelId
        }
      })
    };
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
