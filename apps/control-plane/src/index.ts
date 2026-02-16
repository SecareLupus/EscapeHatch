import { buildApp } from "./app.js";
import { config } from "./config.js";
import { initDb } from "./db/client.js";
import { startDiscordBot } from "./services/discord-bot-client.js";

const app = await buildApp();
await initDb();
await startDiscordBot();

app.listen({ port: config.port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
