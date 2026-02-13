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
    discordUserInfoUrl: process.env.OIDC_DISCORD_USERINFO_URL ?? "https://discord.com/api/users/@me"
  },
  synapse: {
    baseUrl: process.env.SYNAPSE_BASE_URL,
    accessToken: process.env.SYNAPSE_ACCESS_TOKEN
  }
};
