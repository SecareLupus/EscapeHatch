export const config = {
  port: Number(process.env.PORT ?? "4000"),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:4000",
  webBaseUrl: process.env.WEB_BASE_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-session-secret",
  devAuthBypass: process.env.DEV_AUTH_BYPASS === "true",
  setupBootstrapEnabled: process.env.SETUP_BOOTSTRAP_ENABLED !== "false",
  setupBootstrapToken: process.env.SETUP_BOOTSTRAP_TOKEN ?? "",
  oidc: {
    keycloakIssuer: process.env.OIDC_KEYCLOAK_ISSUER,
    keycloakClientId: process.env.OIDC_KEYCLOAK_CLIENT_ID,
    keycloakClientSecret: process.env.OIDC_KEYCLOAK_CLIENT_SECRET,
    discordClientId: process.env.OIDC_DISCORD_CLIENT_ID,
    discordClientSecret: process.env.OIDC_DISCORD_CLIENT_SECRET,
    discordAuthorizeUrl:
      process.env.OIDC_DISCORD_AUTHORIZE_URL ?? "https://discord.com/api/oauth2/authorize",
    discordTokenUrl: process.env.OIDC_DISCORD_TOKEN_URL ?? "https://discord.com/api/oauth2/token",
    discordUserInfoUrl: process.env.OIDC_DISCORD_USERINFO_URL ?? "https://discord.com/api/users/@me",
    googleClientId: process.env.OIDC_GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.OIDC_GOOGLE_CLIENT_SECRET,
    googleAuthorizeUrl:
      process.env.OIDC_GOOGLE_AUTHORIZE_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
    googleTokenUrl: process.env.OIDC_GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
    googleUserInfoUrl: process.env.OIDC_GOOGLE_USERINFO_URL ?? "https://openidconnect.googleapis.com/v1/userinfo",
    twitchClientId: process.env.OIDC_TWITCH_CLIENT_ID,
    twitchClientSecret: process.env.OIDC_TWITCH_CLIENT_SECRET,
    twitchAuthorizeUrl: process.env.OIDC_TWITCH_AUTHORIZE_URL ?? "https://id.twitch.tv/oauth2/authorize",
    twitchTokenUrl: process.env.OIDC_TWITCH_TOKEN_URL ?? "https://id.twitch.tv/oauth2/token",
    twitchUserInfoUrl: process.env.OIDC_TWITCH_USERINFO_URL ?? "https://api.twitch.tv/helix/users"
  },
  synapse: {
    baseUrl: process.env.SYNAPSE_BASE_URL,
    accessToken: process.env.SYNAPSE_ACCESS_TOKEN,
    strictProvisioning: process.env.SYNAPSE_STRICT_PROVISIONING === "true"
  }
};
