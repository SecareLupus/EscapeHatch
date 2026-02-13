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
    reply.code(401).send({ message: "Unauthorized" });
    return;
  }

  request.auth = {
    productUserId: session.productUserId,
    provider: session.provider,
    oidcSubject: session.oidcSubject
  };
}

export async function requireInitialized(_: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const initialized = await hasInitializedPlatform();
    if (!initialized) {
      reply
        .code(503)
        .send({ message: "Platform not initialized. Complete bootstrap first.", code: "not_initialized" });
    }
  } catch (error) {
    reply.code(503).send({
      message: error instanceof Error ? error.message : "Platform initialization check failed.",
      code: "initialization_check_failed"
    });
  }
}
