import Fastify from "fastify";
import { STATUS_CODES } from "node:http";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerDomainRoutes } from "./routes/domain-routes.js";

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const parsedError = error instanceof Error ? error : new Error("Internal Server Error");
    const statusCode = (() => {
      if (parsedError instanceof ZodError) {
        return 400;
      }
      if ("statusCode" in parsedError && typeof parsedError.statusCode === "number") {
        return parsedError.statusCode;
      }
      return 500;
    })();

    const code = parsedError instanceof ZodError ? "validation_error" : "internal_error";
    const message =
      parsedError instanceof ZodError
        ? "Request validation failed."
        : parsedError.message || STATUS_CODES[statusCode] || "Internal Server Error";
    const errorLabel = STATUS_CODES[statusCode] ?? "Error";

    reply.code(statusCode).send({
      statusCode,
      error: errorLabel,
      code,
      message,
      requestId: request.id
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      code: "not_found",
      message: `Route ${request.method} ${request.url} not found.`,
      requestId: request.id
    });
  });

  await registerAuthRoutes(app);
  await registerDomainRoutes(app);
  return app;
}
