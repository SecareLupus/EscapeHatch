import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export interface SessionPayload {
  productUserId: string;
  provider: string;
  oidcSubject: string;
  expiresAt: number;
}

export function createSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(encoded)
    .digest("base64url");

  if (expected !== signature) {
    return null;
  }

  const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  if (Date.now() > decoded.expiresAt) {
    return null;
  }

  return decoded;
}

export function setSessionCookie(reply: FastifyReply, payload: Omit<SessionPayload, "expiresAt">): void {
  const ttlSeconds = Math.max(60, config.sessionTtlSeconds);
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const token = createSessionToken({ ...payload, expiresAt });
  reply.header(
    "Set-Cookie",
    `escapehatch_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}`
  );
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header("Set-Cookie", "escapehatch_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

export function getSession(request: FastifyRequest): SessionPayload | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("escapehatch_session="));

  if (!raw) {
    return null;
  }

  return verify(raw.replace("escapehatch_session=", ""));
}
