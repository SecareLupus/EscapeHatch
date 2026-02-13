import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_SERVER_BLUEPRINT } from "@escapehatch/shared";
import { config } from "../config.js";
import { requireAuth, requireInitialized } from "../auth/middleware.js";
import { createChannelWorkflow, createServerWorkflow } from "../services/provisioning-service.js";
import {
  createReport,
  listReports,
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
  isActionAllowed,
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
  listMentionMarkers,
  listChannelReadStates,
  listServers,
  moveChannelToCategory,
  renameCategory,
  renameChannel,
  renameServer,
  updateChannelVideoControls,
  upsertChannelReadState
} from "../services/chat-service.js";
import { getBootstrapStatus } from "../services/bootstrap-service.js";
import { publishChannelMessage, subscribeToChannelMessages } from "../services/chat-realtime.js";
import { listHubsForUser } from "../services/hub-service.js";
import {
  joinVoicePresence,
  leaveVoicePresence,
  listVoicePresence,
  updateVoicePresenceState
} from "../services/voice-presence-service.js";
import {
  getHubFederationPolicy,
  listFederationPolicyEvents,
  listFederationPolicyStatuses,
  reconcileHubFederationPolicy,
  upsertHubFederationPolicy
} from "../services/federation-service.js";
import {
  completeDiscordOauthAndListGuilds,
  consumeDiscordOauthState,
  createDiscordConnectUrl,
  deleteDiscordChannelMapping,
  getDiscordBridgeConnection,
  getPendingDiscordGuildSelection,
  listDiscordChannelMappings,
  relayDiscordMessageToMappedChannel,
  retryDiscordBridgeSync,
  selectDiscordGuild,
  upsertDiscordChannelMapping
} from "../services/discord-bridge-service.js";
import {
  assignSpaceAdmin,
  expireSpaceAdminAssignments,
  hasActiveSpaceAdminAssignment,
  listDelegationAuditEvents,
  listSpaceAdminAssignments,
  revokeSpaceAdminAssignment,
  transferSpaceOwnership
} from "../services/delegation-service.js";

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

  app.get("/v1/hubs/:hubId/federation-policy", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    const [policy, statuses, events] = await Promise.all([
      getHubFederationPolicy(params.hubId),
      listFederationPolicyStatuses(params.hubId),
      listFederationPolicyEvents(params.hubId, 20)
    ]);
    return {
      policy,
      status: {
        totalRooms: statuses.length,
        appliedRooms: statuses.filter((item) => item.status === "applied").length,
        errorRooms: statuses.filter((item) => item.status === "error").length,
        skippedRooms: statuses.filter((item) => item.status === "skipped").length
      },
      rooms: statuses,
      recentChanges: events
    };
  });

  app.put("/v1/hubs/:hubId/federation-policy", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        allowlist: z.array(z.string().min(1)).max(100).default([])
      })
      .parse(request.body ?? {});
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    const policy = await upsertHubFederationPolicy({
      hubId: params.hubId,
      allowlist: payload.allowlist,
      actorUserId: request.auth!.productUserId
    });
    reply.code(200);
    return policy;
  });

  app.post("/v1/hubs/:hubId/federation-policy/reconcile", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    const result = await reconcileHubFederationPolicy({
      hubId: params.hubId,
      actorUserId: request.auth!.productUserId
    });
    return result;
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

  app.get("/v1/servers/:serverId/read-states", initializedAuthHandlers, async (request) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    return {
      items: await listChannelReadStates({
        productUserId: request.auth!.productUserId,
        serverId: params.serverId
      })
    };
  });

  app.put("/v1/channels/:channelId/read-state", initializedAuthHandlers, async (request) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        at: z.string().datetime().optional()
      })
      .parse(request.body ?? {});

    return upsertChannelReadState({
      productUserId: request.auth!.productUserId,
      channelId: params.channelId,
      at: payload.at
    });
  });

  app.get("/v1/channels/:channelId/mentions", initializedAuthHandlers, async (request) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(300).optional() }).parse(request.query);
    return {
      items: await listMentionMarkers({
        productUserId: request.auth!.productUserId,
        channelId: params.channelId,
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

    await grantRole({
      actorUserId: request.auth!.productUserId,
      ...payload
    });
    reply.code(204).send();
  });

  app.post("/v1/servers/:serverId/delegation/space-admins", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        productUserId: z.string().min(1),
        expiresAt: z.string().datetime().optional()
      })
      .parse(request.body);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: params.serverId
    });
    if (!allowed) {
      reply.code(403).send({
        message: "Forbidden: delegation assignment is outside assigned scope.",
        code: "forbidden_scope"
      });
      return;
    }

    const assignment = await assignSpaceAdmin({
      actorUserId: request.auth!.productUserId,
      assignedUserId: payload.productUserId,
      serverId: params.serverId,
      expiresAt: payload.expiresAt
    });

    reply.code(201);
    return assignment;
  });

  app.get("/v1/servers/:serverId/delegation/space-admins", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    await expireSpaceAdminAssignments({ serverId: params.serverId });
    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: params.serverId
    });
    if (!allowed) {
      reply.code(403).send({
        message: "Forbidden: delegation read is outside assigned scope.",
        code: "forbidden_scope"
      });
      return;
    }
    return {
      items: await listSpaceAdminAssignments(params.serverId)
    };
  });

  app.delete("/v1/delegation/space-admins/:assignmentId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ assignmentId: z.string().min(1) }).parse(request.params);
    const query = z.object({ serverId: z.string().min(1) }).parse(request.query);

    const allowed = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: query.serverId
    });
    if (!allowed) {
      reply.code(403).send({
        message: "Forbidden: delegation revoke is outside assigned scope.",
        code: "forbidden_scope"
      });
      return;
    }

    await revokeSpaceAdminAssignment({
      actorUserId: request.auth!.productUserId,
      assignmentId: params.assignmentId
    });
    reply.code(204).send();
  });

  app.post("/v1/servers/:serverId/delegation/ownership/transfer", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ serverId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        newOwnerUserId: z.string().min(1)
      })
      .parse(request.body);

    const serverRows = await listServers();
    const server = serverRows.find((item) => item.id === params.serverId);
    if (!server) {
      reply.code(404).send({ message: "Server not found." });
      return;
    }

    const hasScopeManagement = await canManageServer({
      productUserId: request.auth!.productUserId,
      serverId: params.serverId
    });
    const isCurrentOwner = server.ownerUserId === request.auth!.productUserId;
    if (!hasScopeManagement && !isCurrentOwner) {
      reply.code(403).send({
        message: "Forbidden: ownership transfer is outside assigned scope.",
        code: "forbidden_scope"
      });
      return;
    }

    const transfer = await transferSpaceOwnership({
      actorUserId: request.auth!.productUserId,
      serverId: params.serverId,
      newOwnerUserId: payload.newOwnerUserId
    });

    if (!(await hasActiveSpaceAdminAssignment({ productUserId: payload.newOwnerUserId, serverId: params.serverId }))) {
      await assignSpaceAdmin({
        actorUserId: request.auth!.productUserId,
        assignedUserId: payload.newOwnerUserId,
        serverId: params.serverId
      });
    }

    return transfer;
  });

  app.get("/v1/hubs/:hubId/delegation/audit-events", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query);

    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({
        message: "Forbidden: delegation audit read is outside assigned scope.",
        code: "forbidden_scope"
      });
      return;
    }

    return {
      items: await listDelegationAuditEvents({
        hubId: params.hubId,
        limit: query.limit
      })
    };
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

  app.patch("/v1/channels/:channelId/video-controls", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        serverId: z.string().min(1),
        videoEnabled: z.boolean(),
        maxVideoParticipants: z.number().int().min(1).max(16).optional()
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
      return await updateChannelVideoControls({
        channelId: params.channelId,
        serverId: payload.serverId,
        videoEnabled: payload.videoEnabled,
        maxVideoParticipants: payload.maxVideoParticipants
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Voice channel not found.") {
        reply.code(404).send({ message: error.message });
        return;
      }
      throw error;
    }
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

  app.get("/v1/reports", initializedAuthHandlers, async (request, reply) => {
    const query = z
      .object({
        serverId: z.string().min(1),
        status: z.enum(["open", "triaged", "resolved", "dismissed"]).optional()
      })
      .parse(request.query);

    const allowed = await isActionAllowed({
      productUserId: request.auth!.productUserId,
      action: "reports.triage",
      scope: { serverId: query.serverId }
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: report access is outside assigned scope.", code: "forbidden_scope" });
      return;
    }

    return {
      items: await listReports({
        serverId: query.serverId,
        status: query.status
      })
    };
  });

  app.get("/v1/audit-logs", initializedAuthHandlers, async (request, reply) => {
    const query = z.object({ serverId: z.string().min(1) }).parse(request.query);
    const allowed = await isActionAllowed({
      productUserId: request.auth!.productUserId,
      action: "audit.read",
      scope: { serverId: query.serverId }
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: audit access is outside assigned scope.", code: "forbidden_scope" });
      return;
    }
    return { items: await listAuditLogs(query.serverId) };
  });

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

  app.get("/v1/discord/oauth/start", initializedAuthHandlers, async (request, reply) => {
    const query = z.object({ hubId: z.string().min(1) }).parse(request.query);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: query.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }

    const url = createDiscordConnectUrl({
      hubId: query.hubId,
      productUserId: request.auth!.productUserId
    });
    reply.redirect(url, 302);
  });

  app.get("/v1/discord/oauth/callback", initializedAuthHandlers, async (request, reply) => {
    const query = z.object({ code: z.string(), state: z.string() }).parse(request.query);
    const state = consumeDiscordOauthState(query.state);
    if (!state || state.productUserId !== request.auth!.productUserId) {
      reply.code(400).send({ message: "Invalid Discord bridge OAuth state." });
      return;
    }

    const completed = await completeDiscordOauthAndListGuilds({
      hubId: state.hubId,
      productUserId: request.auth!.productUserId,
      code: query.code
    });
    const redirect = new URL(config.webBaseUrl);
    redirect.searchParams.set("discordPendingSelection", completed.pendingSelectionId);
    reply.redirect(redirect.toString(), 302);
  });

  app.get("/v1/discord/bridge/pending/:pendingSelectionId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ pendingSelectionId: z.string().min(1) }).parse(request.params);
    const pending = getPendingDiscordGuildSelection({
      pendingSelectionId: params.pendingSelectionId,
      productUserId: request.auth!.productUserId
    });
    if (!pending) {
      reply.code(404).send({ message: "Pending Discord bridge selection not found." });
      return;
    }
    return pending;
  });

  app.post("/v1/discord/bridge/pending/:pendingSelectionId/select", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ pendingSelectionId: z.string().min(1) }).parse(request.params);
    const payload = z.object({ guildId: z.string().min(1) }).parse(request.body);
    try {
      const connection = await selectDiscordGuild({
        pendingSelectionId: params.pendingSelectionId,
        productUserId: request.auth!.productUserId,
        guildId: payload.guildId
      });
      return connection;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        reply.code(404).send({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.get("/v1/discord/bridge/:hubId/health", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }
    const connection = await getDiscordBridgeConnection(params.hubId);
    const mappings = await listDiscordChannelMappings(params.hubId);
    return {
      connection,
      mappingCount: mappings.length,
      activeMappingCount: mappings.filter((mapping) => mapping.enabled).length
    };
  });

  app.post("/v1/discord/bridge/:hubId/retry-sync", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }
    try {
      return await retryDiscordBridgeSync(params.hubId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        reply.code(404).send({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.get("/v1/discord/bridge/:hubId/mappings", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }
    return { items: await listDiscordChannelMappings(params.hubId) };
  });

  app.put("/v1/discord/bridge/:hubId/mappings", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        guildId: z.string().min(1),
        discordChannelId: z.string().min(1),
        discordChannelName: z.string().min(1),
        matrixChannelId: z.string().min(1),
        enabled: z.boolean().default(true)
      })
      .parse(request.body);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }
    return upsertDiscordChannelMapping({
      hubId: params.hubId,
      ...payload
    });
  });

  app.delete("/v1/discord/bridge/:hubId/mappings/:mappingId", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1), mappingId: z.string().min(1) }).parse(request.params);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }
    await deleteDiscordChannelMapping({
      hubId: params.hubId,
      mappingId: params.mappingId
    });
    reply.code(204).send();
  });

  app.post("/v1/discord/bridge/:hubId/relay", initializedAuthHandlers, async (request, reply) => {
    const params = z.object({ hubId: z.string().min(1) }).parse(request.params);
    const payload = z
      .object({
        discordChannelId: z.string().min(1),
        authorName: z.string().min(1),
        content: z.string().min(1).max(2000),
        mediaUrls: z.array(z.string().url()).max(8).optional()
      })
      .parse(request.body);
    const allowed = await canManageHub({
      productUserId: request.auth!.productUserId,
      hubId: params.hubId
    });
    if (!allowed) {
      reply.code(403).send({ message: "Forbidden: insufficient hub management scope." });
      return;
    }
    return relayDiscordMessageToMappedChannel({
      hubId: params.hubId,
      ...payload
    });
  });
}
