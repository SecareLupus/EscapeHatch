import "./load-env.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { startDiscordBot } from "./services/discord-bot-client.js";

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`Control plane running at http://localhost:${config.port}`);

    // Start Discord bot client
    await startDiscordBot();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
