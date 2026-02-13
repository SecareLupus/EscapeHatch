import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuthorizationRedirect, exchangeDiscordCode } from "../auth/oidc.js";
import { clearSessionCookie, setSessionCookie } from "../auth/session.js";
import { getIdentityByProductUserId, upsertIdentityMapping } from "../services/identity-service.js";
import { requireAuth } from "../auth/middleware.js";
import type { AccountLinkingRequirement, IdentityProvider } from "@escapehatch/shared";
import { config } from "../config.js";

const providerSchema = z.enum(["discord", "keycloak", "google", "github"]);

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
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
      }
    ];
    return { primaryProvider: "discord", providers };
  });

  app.get("/auth/login/:provider", async (request, reply) => {
    const { provider } = z.object({ provider: providerSchema }).parse(request.params);
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

    reply.redirect(`${config.webBaseUrl}?auth=success`, 302);
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
}
