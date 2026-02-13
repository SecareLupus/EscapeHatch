import crypto from "node:crypto";
import { config } from "../config.js";
import type { IdentityProvider } from "@escapehatch/shared";

type SupportedOidcProvider = "discord" | "google" | "twitch";
type OidcIntent = "login" | "link";

interface OidcStateEntry {
  provider: SupportedOidcProvider;
  verifier: string;
  intent: OidcIntent;
  productUserId?: string;
}

interface OidcProfile {
  provider: SupportedOidcProvider;
  oidcSubject: string;
  email: string | null;
  preferredUsername: string | null;
  avatarUrl: string | null;
}

const inMemoryState = new Map<string, OidcStateEntry>();

function isSupportedProvider(provider: IdentityProvider): provider is SupportedOidcProvider {
  return provider === "discord" || provider === "google" || provider === "twitch";
}

function ensureProviderEnabled(provider: SupportedOidcProvider): void {
  if (provider === "discord" && !config.oidc.discordClientId) {
    throw new Error("OIDC_DISCORD_CLIENT_ID is not set.");
  }
  if (provider === "google" && !config.oidc.googleClientId) {
    throw new Error("OIDC_GOOGLE_CLIENT_ID is not set.");
  }
  if (provider === "twitch" && !config.oidc.twitchClientId) {
    throw new Error("OIDC_TWITCH_CLIENT_ID is not set.");
  }
}

function createPkce(): { state: string; verifier: string; challenge: string } {
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

function callbackUrl(provider: SupportedOidcProvider): string {
  return `${config.appBaseUrl}/auth/callback/${provider}`;
}

export function createAuthorizationRedirect(input: {
  provider: IdentityProvider;
  intent: OidcIntent;
  productUserId?: string;
}): string {
  if (!isSupportedProvider(input.provider)) {
    throw new Error("Provider does not support direct OIDC in current milestone.");
  }

  const provider = input.provider;
  ensureProviderEnabled(provider);

  const { state, verifier, challenge } = createPkce();
  inMemoryState.set(state, {
    provider,
    verifier,
    intent: input.intent,
    productUserId: input.productUserId
  });

  const redirectUri = callbackUrl(provider);
  if (provider === "discord") {
    const query = new URLSearchParams({
      client_id: config.oidc.discordClientId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "consent"
    });
    return `${config.oidc.discordAuthorizeUrl}?${query.toString()}`;
  }

  if (provider === "google") {
    const query = new URLSearchParams({
      client_id: config.oidc.googleClientId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent"
    });
    return `${config.oidc.googleAuthorizeUrl}?${query.toString()}`;
  }

  const query = new URLSearchParams({
    client_id: config.oidc.twitchClientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "user:read:email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    force_verify: "true"
  });
  return `${config.oidc.twitchAuthorizeUrl}?${query.toString()}`;
}

interface ExchangeTokenInput {
  code: string;
  state: string;
}

interface OidcExchangeResult {
  profile: OidcProfile;
  intent: OidcIntent;
  productUserId?: string;
}

export async function exchangeAuthorizationCode(input: ExchangeTokenInput): Promise<OidcExchangeResult> {
  const stateEntry = inMemoryState.get(input.state);
  if (!stateEntry) {
    throw new Error("Invalid OIDC state.");
  }
  inMemoryState.delete(input.state);

  if (stateEntry.provider === "discord") {
    return {
      profile: await exchangeDiscordCode(input.code, stateEntry.verifier),
      intent: stateEntry.intent,
      productUserId: stateEntry.productUserId
    };
  }

  if (stateEntry.provider === "google") {
    return {
      profile: await exchangeGoogleCode(input.code, stateEntry.verifier),
      intent: stateEntry.intent,
      productUserId: stateEntry.productUserId
    };
  }

  return {
    profile: await exchangeTwitchCode(input.code, stateEntry.verifier),
    intent: stateEntry.intent,
    productUserId: stateEntry.productUserId
  };
}

async function exchangeDiscordCode(code: string, verifier: string): Promise<OidcProfile> {
  if (!config.oidc.discordClientId || !config.oidc.discordClientSecret) {
    throw new Error("Discord OIDC client credentials are missing.");
  }

  const tokenResponse = await fetch(config.oidc.discordTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.oidc.discordClientId,
      client_secret: config.oidc.discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl("discord"),
      code_verifier: verifier
    })
  });
  if (!tokenResponse.ok) {
    throw new Error(`Discord token exchange failed (${tokenResponse.status}).`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token: string };
  const userResponse = await fetch(config.oidc.discordUserInfoUrl, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  if (!userResponse.ok) {
    throw new Error(`Unable to load Discord profile (${userResponse.status}).`);
  }

  const profile = (await userResponse.json()) as {
    id: string;
    email?: string;
    username?: string;
    avatar?: string;
  };

  return {
    provider: "discord",
    oidcSubject: profile.id,
    email: profile.email ?? null,
    preferredUsername: null,
    avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null
  };
}

async function exchangeGoogleCode(code: string, verifier: string): Promise<OidcProfile> {
  if (!config.oidc.googleClientId || !config.oidc.googleClientSecret) {
    throw new Error("Google OIDC client credentials are missing.");
  }

  const tokenResponse = await fetch(config.oidc.googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.oidc.googleClientId,
      client_secret: config.oidc.googleClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl("google"),
      code_verifier: verifier
    })
  });
  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token: string };
  const userResponse = await fetch(config.oidc.googleUserInfoUrl, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  if (!userResponse.ok) {
    throw new Error(`Unable to load Google profile (${userResponse.status}).`);
  }

  const profile = (await userResponse.json()) as {
    sub: string;
    email?: string;
    picture?: string;
  };

  return {
    provider: "google",
    oidcSubject: profile.sub,
    email: profile.email ?? null,
    preferredUsername: null,
    avatarUrl: profile.picture ?? null
  };
}

async function exchangeTwitchCode(code: string, verifier: string): Promise<OidcProfile> {
  if (!config.oidc.twitchClientId || !config.oidc.twitchClientSecret) {
    throw new Error("Twitch OIDC client credentials are missing.");
  }

  const tokenResponse = await fetch(config.oidc.twitchTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.oidc.twitchClientId,
      client_secret: config.oidc.twitchClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl("twitch"),
      code_verifier: verifier
    })
  });
  if (!tokenResponse.ok) {
    throw new Error(`Twitch token exchange failed (${tokenResponse.status}).`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token: string };
  const userResponse = await fetch(config.oidc.twitchUserInfoUrl, {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "Client-Id": config.oidc.twitchClientId
    }
  });
  if (!userResponse.ok) {
    throw new Error(`Unable to load Twitch profile (${userResponse.status}).`);
  }

  const profileJson = (await userResponse.json()) as {
    data?: Array<{
      id: string;
      email?: string;
      profile_image_url?: string;
    }>;
  };
  const profile = profileJson.data?.[0];
  if (!profile) {
    throw new Error("Twitch profile payload was empty.");
  }

  return {
    provider: "twitch",
    oidcSubject: profile.id,
    email: profile.email ?? null,
    preferredUsername: null,
    avatarUrl: profile.profile_image_url ?? null
  };
}
