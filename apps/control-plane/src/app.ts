import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerDomainRoutes } from "./routes/domain-routes.js";

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);
  await registerAuthRoutes(app);
  await registerDomainRoutes(app);
  return app;
}
