import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "./session.js";

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
