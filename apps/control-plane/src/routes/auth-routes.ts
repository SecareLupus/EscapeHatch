import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuthorizationRedirect, exchangeDiscordCode } from "../auth/oidc.js";
import { clearSessionCookie, setSessionCookie } from "../auth/session.js";
import { getIdentityByProductUserId, upsertIdentityMapping } from "../services/identity-service.js";
import { requireAuth } from "../auth/middleware.js";
import type { AccountLinkingRequirement, IdentityProvider } from "@escapehatch/shared";
import { config } from "../config.js";
import { bootstrapAdmin, getBootstrapStatus } from "../services/bootstrap-service.js";

const providerSchema = z.enum(["discord", "keycloak", "google", "github", "dev"]);

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/bootstrap-status", async (_, reply) => {
    try {
      return await getBootstrapStatus();
    } catch (error) {
      reply.code(503).send({
        initialized: false,
        code: "bootstrap_status_unavailable",
        message: error instanceof Error ? error.message : "Bootstrap status unavailable."
      });
    }
  });

  app.get("/auth/providers", async () => {
    const providers: AccountLinkingRequirement[] = [
      {
        provider: "discord",
        displayName: "Discord",
        isEnabled: Boolean(config.oidc.discordClientId),
        requiresReauthentication: false
      },
      {
        provider: "google",
        displayName: "Google",
        isEnabled: false,
        requiresReauthentication: true
      },
      {
        provider: "github",
        displayName: "GitHub",
        isEnabled: false,
        requiresReauthentication: true
      },
      {
        provider: "dev",
        displayName: "Developer Login",
        isEnabled: config.devAuthBypass,
        requiresReauthentication: false
      }
    ];
    return { primaryProvider: config.devAuthBypass ? "dev" : "discord", providers };
  });

  app.post("/auth/dev-login", async (request, reply) => {
    if (!config.devAuthBypass) {
      reply.code(404).send({ message: "Developer auth is disabled." });
      return;
    }

    const payload = z
      .object({
        username: z.string().min(3).max(40).default("local-admin"),
        email: z.string().email().optional()
      })
      .parse(request.body ?? {});

    const normalizedSubject = payload.username.trim().toLowerCase().replaceAll(/\s+/g, "-");
    const identity = await upsertIdentityMapping({
      provider: "dev",
      oidcSubject: normalizedSubject,
      email: payload.email ?? `${normalizedSubject}@dev.local`,
      preferredUsername: payload.username,
      avatarUrl: null
    });

    setSessionCookie(reply, {
      productUserId: identity.productUserId,
      provider: identity.provider,
      oidcSubject: identity.oidcSubject
    });

    return {
      productUserId: identity.productUserId,
      provider: identity.provider,
      preferredUsername: identity.preferredUsername
    };
  });

  app.get("/auth/dev-login", async (request, reply) => {
    if (!config.devAuthBypass) {
      reply.code(404).send({ message: "Developer auth is disabled." });
      return;
    }

    const query = z
      .object({
        username: z.string().min(3).max(40).default("local-admin"),
        email: z.string().email().optional(),
        redirectTo: z.string().url().optional()
      })
      .parse(request.query);

    const normalizedSubject = query.username.trim().toLowerCase().replaceAll(/\s+/g, "-");
    const identity = await upsertIdentityMapping({
      provider: "dev",
      oidcSubject: normalizedSubject,
      email: query.email ?? `${normalizedSubject}@dev.local`,
      preferredUsername: query.username,
      avatarUrl: null
    });

    setSessionCookie(reply, {
      productUserId: identity.productUserId,
      provider: identity.provider,
      oidcSubject: identity.oidcSubject
    });

    reply.redirect(query.redirectTo ?? config.webBaseUrl, 302);
  });

  app.get("/auth/login/:provider", async (request, reply) => {
    const { provider } = z.object({ provider: providerSchema }).parse(request.params);
    if (provider === "dev") {
      reply.code(404).send({ message: "Use POST /auth/dev-login for developer login." });
      return;
    }
    const redirect = createAuthorizationRedirect(provider as IdentityProvider);
    reply.redirect(redirect, 302);
  });

  app.get("/auth/callback/discord", async (request, reply) => {
    const query = z.object({ code: z.string(), state: z.string() }).parse(request.query);
    const profile = await exchangeDiscordCode(query);

    const identity = await upsertIdentityMapping({
      provider: "discord",
      oidcSubject: profile.id,
      email: profile.email ?? null,
      preferredUsername: profile.username ?? null,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null
    });

    setSessionCookie(reply, {
      productUserId: identity.productUserId,
      provider: identity.provider,
      oidcSubject: identity.oidcSubject
    });

    reply.redirect(config.webBaseUrl, 302);
  });

  app.get("/auth/session/me", { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new Error("Auth context missing");
    }

    const identity = await getIdentityByProductUserId(auth.productUserId);
    return {
      productUserId: auth.productUserId,
      identity: identity
        ? {
            provider: identity.provider,
            oidcSubject: identity.oidcSubject,
            email: identity.email,
            preferredUsername: identity.preferredUsername,
            avatarUrl: identity.avatarUrl,
            matrixUserId: identity.matrixUserId
          }
        : null
    };
  });

  app.post("/auth/logout", async (_, reply) => {
    clearSessionCookie(reply);
    reply.code(204).send();
  });

  app.post("/auth/bootstrap-admin", { preHandler: requireAuth }, async (request, reply) => {
    if (!config.setupBootstrapEnabled) {
      reply.code(403).send({ message: "Bootstrap endpoint is disabled." });
      return;
    }

    const payload = z
      .object({
        setupToken: z.string().min(1),
        hubName: z.string().min(2).max(80)
      })
      .parse(request.body);

    try {
      const result = await bootstrapAdmin({
        productUserId: request.auth!.productUserId,
        setupToken: payload.setupToken,
        expectedSetupToken: config.setupBootstrapToken,
        hubName: payload.hubName
      });

      reply.code(201);
      return {
        initialized: true,
        hubId: result.hubId,
        defaultServerId: result.defaultServerId,
        defaultChannelId: result.defaultChannelId
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bootstrap failed.";

      if (message === "Platform bootstrap already completed.") {
        reply.code(409).send({ message, code: "bootstrap_already_completed" });
        return;
      }

      if (message === "Invalid bootstrap token.") {
        reply.code(403).send({ message, code: "invalid_bootstrap_token" });
        return;
      }

      if (message === "Bootstrap token is not configured.") {
        reply.code(500).send({ message, code: "bootstrap_token_missing" });
        return;
      }

      throw error;
    }
  });
}
