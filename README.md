# EscapeHatch

EscapeHatch is the monorepo for the **Creator Co-Op Hub Chat Platform**: a Matrix-based, Discord-like community product for creator collectives.

## Current local capability

The repository now runs a **usable local chat demo** backed by the control-plane + PostgreSQL:
- Auth: developer login (or Discord OIDC when configured)
- One-time bootstrap: first authenticated user initializes hub/admin
- Chat domain: servers, channels, and persistent channel messages
- Web client: accessible browser UI for login, bootstrap, channel selection, and messaging

Synapse/Discord remain optional for day-one local testing.

## Repository layout

```text
.
├── apps/
│   ├── control-plane/      # Fastify control-plane API + auth/provisioning/chat routes
│   └── web/                # Next.js hosted client (local chat UI)
├── packages/
│   └── shared/             # Shared auth + domain contracts
├── .github/workflows/ci.yml
├── docker-compose.yml      # Local infra: Postgres, Synapse, Keycloak, LiveKit, coturn
└── creator_co_op_hub_chat_platform_project_spec_reference_architecture.md
```

## Quick start (usable local chat)

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm dev
```

- Web UI: http://localhost:3000
- Control plane health: http://localhost:4000/health

`pnpm dev` auto-loads root `.env` for both `apps/control-plane` and `apps/web`.

## First-run flow

1. Open `http://localhost:3000`
2. Sign in (default local path is **Developer Login** when `DEV_AUTH_BYPASS=true`)
3. Run bootstrap in the UI by entering:
- `Hub Name`
- `Setup Token` (must match `SETUP_BOOTSTRAP_TOKEN` from `.env`)
4. Start messaging in the default `#general` channel

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```
