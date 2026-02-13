import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "./session.js";
import { hasInitializedPlatform } from "../services/bootstrap-service.js";

export interface ScopedAuthContext {
  productUserId: string;
  provider: string;
  oidcSubject: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: ScopedAuthContext;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = getSession(request);
  if (!session) {
    reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      code: "unauthorized",
      message: "Unauthorized",
      requestId: request.id
    });
    return;
  }

  request.auth = {
    productUserId: session.productUserId,
    provider: session.provider,
    oidcSubject: session.oidcSubject
  };
}

export async function requireInitialized(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const initialized = await hasInitializedPlatform();
    if (!initialized) {
      reply
        .code(503)
        .send({
          statusCode: 503,
          error: "Service Unavailable",
          message: "Platform not initialized. Complete bootstrap first.",
          code: "not_initialized",
          requestId: request.id
        });
    }
  } catch (error) {
    reply.code(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: error instanceof Error ? error.message : "Platform initialization check failed.",
      code: "initialization_check_failed",
      requestId: request.id
    });
  }
}
