# EscapeHatch

EscapeHatch is the monorepo for the **Creator Co-Op Hub Chat Platform**: a Matrix-based, Discord-like community product for creator collectives.

## Phase progress snapshot

This repository now includes sequential scaffolding for **Phases 1–3** from `TODO.md`:
- **Phase 1:** hardened workspace scripts, env templates, package architecture docs, CI workflow, and smoke tests.
- **Phase 2:** Discord-first OIDC auth flow scaffolding, control-plane auth middleware, identity mapping model, and session lifecycle endpoints.
- **Phase 3:** versioned provisioning APIs (`/v1/servers`, `/v1/channels`), PostgreSQL persistence, Matrix adapter hooks, idempotency, and retries.

## Repository layout

```text
.
├── apps/
│   ├── control-plane/      # Fastify control-plane API + provisioning/auth workflows
│   └── web/                # Next.js hosted client shell
├── packages/
│   └── shared/             # Shared auth + domain contracts
├── .github/workflows/ci.yml
├── docker-compose.yml      # Local infra: Postgres, Synapse, Keycloak, LiveKit, coturn
└── creator_co_op_hub_chat_platform_project_spec_reference_architecture.md
```

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

- Web: http://localhost:3000
- Control plane: http://localhost:4000/health

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```
