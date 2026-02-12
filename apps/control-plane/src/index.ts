import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { z } from "zod";
import { DEFAULT_SERVER_BLUEPRINT } from "@escapehatch/shared";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(sensible);

app.get("/health", async () => {
  return { status: "ok", service: "control-plane" };
});

app.get("/bootstrap/default-server", async () => {
  return DEFAULT_SERVER_BLUEPRINT;
});

app.post("/bootstrap/channel", async (request, reply) => {
  const schema = z.object({
    serverId: z.string().min(1),
    channelName: z.string().min(1),
    type: z.enum(["text", "voice", "announcement"])
  });

  const payload = schema.parse(request.body);

  reply.status(201);
  return {
    id: `ch_${Date.now()}`,
    ...payload,
    provisionStatus: "queued"
  };
});

const port = Number(process.env.PORT ?? "4000");

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
