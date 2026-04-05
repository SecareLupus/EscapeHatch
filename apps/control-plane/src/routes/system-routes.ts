import type { FastifyInstance } from "fastify";
import { DEFAULT_SERVER_BLUEPRINT } from "@skerry/shared";
import { config } from "../config.js";
import { getBootstrapStatus } from "../services/bootstrap-service.js";
import { getMetrics } from "../services/observability-service.js";
import { logEvent } from "../services/observability-service.js";
import { checkSynapseHealth } from "../matrix/synapse-adapter.js";
import { withDb } from "../db/client.js";
import { requireAuth, requireInitialized } from "../auth/middleware.js";

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  const initializedAuthHandlers = { preHandler: [requireAuth, requireInitialized] };

  app.get("/health", async () => {
    const dbOk = config.databaseUrl 
      ? await withDb(async (db) => {
          const res = await db.query("SELECT 1");
          return res.rowCount === 1;
        }).catch(() => false) 
      : true;

    const synapseOk = (config.synapse.baseUrl && config.synapse.asToken)
      ? await checkSynapseHealth().catch(() => false)
      : true;

    if (dbOk && synapseOk) {
      return { 
        status: "ok", 
        service: "control-plane"
      };
    }

    return { 
      status: "degraded", 
      service: "control-plane",
      checks: {
        database: dbOk ? "up" : "down",
        synapse: synapseOk ? "up" : "down"
      }
    };
  });

  app.get("/metrics", async (request, reply) => {
    const { token, allowedIps } = config.metrics;
    const forwardedFor = request.headers["x-forwarded-for"];
    const clientIp = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : request.ip) || "";
    
    let authorized = false;
    
    // Check Token
    if (token) {
      const authHeader = request.headers["authorization"];
      const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : request.headers["x-metrics-token"];
      if (providedToken === token) authorized = true;
    }
    
    // Check IP
    if (!authorized && allowedIps.length > 0) {
      if (allowedIps.includes(clientIp)) authorized = true;
    }
    
    // If neither is configured, we allow it (warning is logged on startup)
    if (!token && allowedIps.length === 0) authorized = true;

    if (!authorized) {
      logEvent("warn", "metrics_access_denied", { clientIp, requestId: request.id });
      reply.code(403).send({ error: "Forbidden", message: "Metrics access denied." });
      return;
    }

    reply.type("text/plain; version=0.0.4; charset=utf-8");
    return getMetrics();
  });

  app.get("/bootstrap/default-server", async () => {
    return DEFAULT_SERVER_BLUEPRINT;
  });

  app.get("/v1/bootstrap/context", initializedAuthHandlers, async () => {
    const status = await getBootstrapStatus();
    return {
      hubId: status.bootstrapHubId,
      defaultServerId: status.defaultServerId,
      defaultChannelId: status.defaultChannelId
    };
  });
}
