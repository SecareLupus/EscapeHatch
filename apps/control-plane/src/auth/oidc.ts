import crypto from "node:crypto";
import { config } from "../config.js";
import type { IdentityProvider } from "@escapehatch/shared";

const inMemoryState = new Map<string, { provider: IdentityProvider; verifier: string }>();

export function createAuthorizationRedirect(provider: IdentityProvider): string {
  if (provider !== "discord") {
    throw new Error("Only Discord provider is enabled in current milestone.");
  }

  if (!config.oidc.discordClientId) {
    throw new Error("OIDC_DISCORD_CLIENT_ID is not set.");
  }

  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  inMemoryState.set(state, { provider, verifier });

  const redirectUri = `${config.appBaseUrl}/auth/callback/discord`;
  const query = new URLSearchParams({
    client_id: config.oidc.discordClientId,
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

interface ExchangeTokenInput {
  code: string;
  state: string;
}

interface DiscordProfile {
  id: string;
  email?: string;
  username?: string;
  avatar?: string;
}

export async function exchangeDiscordCode({ code, state }: ExchangeTokenInput): Promise<DiscordProfile> {
  const stateEntry = inMemoryState.get(state);
  if (!stateEntry) {
    throw new Error("Invalid OIDC state.");
  }

  inMemoryState.delete(state);

  if (!config.oidc.discordClientId || !config.oidc.discordClientSecret) {
    throw new Error("Discord OIDC client credentials are missing.");
  }

  const redirectUri = `${config.appBaseUrl}/auth/callback/discord`;

  const tokenResponse = await fetch(config.oidc.discordTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.oidc.discordClientId,
      client_secret: config.oidc.discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: stateEntry.verifier
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed with status ${tokenResponse.status}`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token: string };
  const userResponse = await fetch(config.oidc.discordUserInfoUrl, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });

  if (!userResponse.ok) {
    throw new Error(`Unable to load Discord profile (${userResponse.status})`);
  }

  return (await userResponse.json()) as DiscordProfile;
}
