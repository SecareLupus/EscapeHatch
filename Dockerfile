# Base stage for pnpm and shared dependencies
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

# --- Build stage ---
FROM base AS build
ARG NEXT_PUBLIC_BASE_DOMAIN
# Create a .env file for the build to ensure Next.js picks it up.
RUN echo "NEXT_PUBLIC_BASE_DOMAIN=${NEXT_PUBLIC_BASE_DOMAIN:-localhost}" > .env && \
    pnpm install --frozen-lockfile && \
    pnpm run build

# --- Control Plane Runtime ---
FROM base AS control-plane
COPY --from=build /app /app
EXPOSE 4000
CMD [ "pnpm", "--filter", "@escapehatch/control-plane", "start" ]

# --- Web App Runtime ---
FROM base AS web
COPY --from=build /app /app
EXPOSE 3000
CMD [ "pnpm", "--filter", "@escapehatch/web", "start" ]
