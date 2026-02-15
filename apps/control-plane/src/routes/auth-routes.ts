import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuthorizationRedirect, exchangeAuthorizationCode } from "../auth/oidc.js";
import { clearSessionCookie, setSessionCookie } from "../auth/session.js";
import {
  findUniqueProductUserIdByEmail,
  getIdentityByProductUserId,
  getIdentityByProviderSubject,
  isOnboardingComplete,
  isPreferredUsernameTaken,
  listIdentitiesByProductUserId,
  setPreferredUsernameForProductUser,
  upsertIdentityMapping,
  updateUserTheme
} from "../services/identity-service.js";
import { requireAuth } from "../auth/middleware.js";
import type { AccountLinkingRequirement, IdentityProvider } from "@escapehatch/shared";
import { config } from "../config.js";
import { bootstrapAdmin, getBootstrapStatus } from "../services/bootstrap-service.js";

const providerSchema = z.enum(["discord", "keycloak", "google", "github", "twitch", "dev"]);

function providerEnabled(provider: IdentityProvider): boolean {
  if (provider === "discord") {
    return Boolean(config.oidc.discordClientId);
  }
  if (provider === "google") {
    return Boolean(config.oidc.googleClientId);
  }
  if (provider === "twitch") {
    return Boolean(config.oidc.twitchClientId);
  }
  if (provider === "dev") {
    return config.devAuthBypass;
  }
  return false;
}

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
        isEnabled: providerEnabled("discord"),
        requiresReauthentication: false
      },
      {
        provider: "google",
        displayName: "Google",
        isEnabled: providerEnabled("google"),
        requiresReauthentication: false
      },
      {
        provider: "twitch",
        displayName: "Twitch",
        isEnabled: providerEnabled("twitch"),
        requiresReauthentication: false
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
        isEnabled: providerEnabled("dev"),
        requiresReauthentication: false
      }
    ];
    const primaryProvider =
      providers.find((provider) => provider.provider === "dev" && provider.isEnabled)?.provider ??
      providers.find((provider) => provider.provider === "discord" && provider.isEnabled)?.provider ??
      providers.find((provider) => provider.provider === "google" && provider.isEnabled)?.provider ??
      providers.find((provider) => provider.provider === "twitch" && provider.isEnabled)?.provider ??
      "discord";

    return { primaryProvider, providers };
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
      preferredUsername: null,
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
      preferredUsername: null,
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
    if (!providerEnabled(provider)) {
      reply.code(404).send({ message: `Provider ${provider} is not enabled.` });
      return;
    }
    const redirect = createAuthorizationRedirect({ provider, intent: "login" });
    reply.redirect(redirect, 302);
  });

  app.get("/auth/link/:provider", { preHandler: requireAuth }, async (request, reply) => {
    const { provider } = z.object({ provider: providerSchema }).parse(request.params);
    if (provider === "dev") {
      reply.code(404).send({ message: "Developer auth does not support account linking." });
      return;
    }
    if (!providerEnabled(provider)) {
      reply.code(404).send({ message: `Provider ${provider} is not enabled.` });
      return;
    }
    const redirect = createAuthorizationRedirect({
      provider,
      intent: "link",
      productUserId: request.auth!.productUserId
    });
    reply.redirect(redirect, 302);
  });

  app.get("/auth/callback/:provider", async (request, reply) => {
    const { provider } = z.object({ provider: providerSchema }).parse(request.params);
    if (provider === "dev") {
      reply.code(400).send({ message: "Developer auth does not use callback endpoints." });
      return;
    }
    const query = z.object({ code: z.string(), state: z.string() }).parse(request.query);
    const exchanged = await exchangeAuthorizationCode(query);
    const profile = exchanged.profile;

    if (provider !== profile.provider) {
      reply.code(400).send({ message: "OIDC callback provider mismatch." });
      return;
    }

    const linkedIdentity = await getIdentityByProviderSubject({
      provider: profile.provider,
      oidcSubject: profile.oidcSubject
    });

    let identity = linkedIdentity;
    if (exchanged.intent === "link") {
      if (!exchanged.productUserId) {
        reply.code(400).send({ message: "Missing account-linking session context." });
        return;
      }
      if (linkedIdentity && linkedIdentity.productUserId !== exchanged.productUserId) {
        reply.code(409).send({
          message: "This provider account is already linked to another user.",
          code: "identity_already_linked"
        });
        return;
      }
      if (!linkedIdentity) {
        identity = await upsertIdentityMapping({
          provider: profile.provider,
          oidcSubject: profile.oidcSubject,
          email: profile.email,
          preferredUsername: null,
          avatarUrl: profile.avatarUrl,
          productUserId: exchanged.productUserId
        });
      }
    } else if (!linkedIdentity) {
      const existingUserIdFromEmail =
        profile.email ? await findUniqueProductUserIdByEmail(profile.email) : null;
      identity = await upsertIdentityMapping({
        provider: profile.provider,
        oidcSubject: profile.oidcSubject,
        email: profile.email,
        preferredUsername: null,
        avatarUrl: profile.avatarUrl,
        productUserId: existingUserIdFromEmail ?? undefined
      });
    }

    if (!identity) {
      throw new Error("Identity mapping could not be resolved.");
    }

    setSessionCookie(reply, {
      productUserId: identity.productUserId,
      provider: identity.provider,
      oidcSubject: identity.oidcSubject
    });

    const destination =
      exchanged.intent === "link" ? `${config.webBaseUrl}?linked=${encodeURIComponent(profile.provider)}` : config.webBaseUrl;
    reply.redirect(destination, 302);
  });

  app.get("/auth/session/me", { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new Error("Auth context missing");
    }

    const [activeIdentity, identities, onboardingComplete] = await Promise.all([
      getIdentityByProviderSubject({
        provider: auth.provider as IdentityProvider,
        oidcSubject: auth.oidcSubject
      }),
      listIdentitiesByProductUserId(auth.productUserId),
      isOnboardingComplete(auth.productUserId)
    ]);

    const fallbackIdentity = await getIdentityByProductUserId(auth.productUserId);
    const resolvedIdentity = activeIdentity ?? fallbackIdentity;
    return {
      productUserId: auth.productUserId,
      identity: resolvedIdentity
        ? {
          provider: resolvedIdentity.provider,
          oidcSubject: resolvedIdentity.oidcSubject,
          email: resolvedIdentity.email,
          preferredUsername: resolvedIdentity.preferredUsername,
          avatarUrl: resolvedIdentity.avatarUrl,
          matrixUserId: resolvedIdentity.matrixUserId,
          theme: resolvedIdentity.theme
        }
        : null,
      linkedIdentities: identities.map((identity) => ({
        provider: identity.provider,
        oidcSubject: identity.oidcSubject,
        email: identity.email,
        preferredUsername: identity.preferredUsername,
        avatarUrl: identity.avatarUrl,
        theme: identity.theme
      })),
      needsOnboarding: !onboardingComplete
    };
  });

  app.patch("/auth/session/me/theme", { preHandler: requireAuth }, async (request, reply) => {
    const { theme } = z.object({ theme: z.enum(["light", "dark"]) }).parse(request.body);
    await updateUserTheme(request.auth!.productUserId, theme);
    reply.code(204).send();
  });

  app.post("/auth/onboarding/username", { preHandler: requireAuth }, async (request, reply) => {
    const payload = z
      .object({
        username: z
          .string()
          .min(3)
          .max(40)
          .regex(/^[a-zA-Z0-9._-]+$/)
      })
      .parse(request.body);

    const normalizedUsername = payload.username.trim();
    const taken = await isPreferredUsernameTaken({
      preferredUsername: normalizedUsername,
      excludingProductUserId: request.auth!.productUserId
    });
    if (taken) {
      reply.code(409).send({
        message: "Username is already taken.",
        code: "username_taken"
      });
      return;
    }

    await setPreferredUsernameForProductUser({
      productUserId: request.auth!.productUserId,
      preferredUsername: normalizedUsername
    });
    reply.code(204).send();
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
