# EscapeHatch

EscapeHatch is the bootstrap monorepo for the **Creator Co-Op Hub Chat Platform**: a Matrix-based, Discord-like community product for creator collectives.

This repository turns the root spec into a runnable foundation with:
- a hosted web client shell,
- a control-plane API scaffold,
- shared domain contracts,
- local infrastructure composition for Matrix + voice + identity primitives.

## Spec-first goals

The architecture target comes from:
- `creator_co_op_hub_chat_platform_project_spec_reference_architecture.md`

Current scaffolding is designed to support the first milestones:
1. Hub bootstrap,
2. Discord semantics mapping,
3. Moderation and voice integration foundations.

## Repository layout

```text
.
├── apps/
│   ├── control-plane/      # Fastify + TypeScript control-plane API scaffold
│   └── web/                # Next.js hosted client shell
├── packages/
│   └── shared/             # Shared platform contracts/types
├── docker/
│   └── synapse/            # Synapse data/config mount point
├── docker-compose.yml      # Local infra: Postgres, Synapse, Keycloak, LiveKit, coturn
├── AGENTS.md               # Contributor/agent instructions
└── creator_co_op_hub_chat_platform_project_spec_reference_architecture.md
```

## Framework instantiations

### Web client (`apps/web`)
- **Next.js 14 + React 18**
- Initial Discord-like layout shell:
  - server rail,
  - channel rail,
  - main timeline panel.
- Dependencies included for Matrix SDK integration.

### Control plane (`apps/control-plane`)
- **Fastify 5 + TypeScript + Zod**
- Bootstrap endpoints:
  - `GET /health`
  - `GET /bootstrap/default-server`
  - `POST /bootstrap/channel`
- Uses shared contracts from `@escapehatch/shared`.

### Shared contracts (`packages/shared`)
- Core role/channel typing
- Default server blueprint contract used by control-plane

### Infra composition (`docker-compose.yml`)
- **PostgreSQL**
- **Synapse**
- **Keycloak**
- **LiveKit**
- **coturn**

This is a pragmatic local bootstrap, not a production deployment profile.

## Quick start

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start app development services

```bash
pnpm dev
```

- Web: http://localhost:3000
- Control plane: http://localhost:4000/health

### 3) (Optional) Start platform infrastructure

```bash
docker compose up -d
```

## Next glue-up targets

Near-term implementation tasks:
- Wire OIDC login flow between web client, Keycloak, and Synapse.
- Add control-plane persistence (PostgreSQL) and mapping tables for server/channel ↔ Matrix IDs.
- Add Matrix room/space provisioning adapters behind control-plane routes.
- Add SFU token issuance flow and voice channel binding to `sfu_room_id`.
- Begin creator-scoped moderation action APIs and audit logging.

## Development commands

At repo root:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```
