# Control Plane Architecture

## Ownership boundary
- Policy gate for privileged hub/server/channel operations.
- Identity/session source for web client auth context.
- Provisioning orchestrator for Matrix entities (space/room mappings).

## Extension points
- `src/routes`: HTTP surface (versioned domain APIs).
- `src/services`: workflow logic, retries, idempotency handling.
- `src/matrix`: Synapse integration adapter.
- `src/auth`: OIDC/session middleware and auth lifecycle.
- `src/db`: persistence bootstrapping and storage access.

## Milestone alignment
- Milestone 0: Discord-first OIDC auth scaffolding + identity mapping.
- Milestone 1: server/channel provisioning through `/v1/servers` + `/v1/channels`.

## Local bootstrap flow
- `POST /auth/dev-login` creates a local dev session when `DEV_AUTH_BYPASS=true`.
- `POST /auth/bootstrap-admin` performs one-time admin bootstrap (requires session + `SETUP_BOOTSTRAP_TOKEN`).
- `GET /auth/bootstrap-status` reports whether setup is complete.
- `/v1/*` routes are blocked with `503 not_initialized` until bootstrap succeeds.
- Dev/test/start scripts auto-load root `.env` via `dotenv -e ../../.env -- ...`.

## Local chat endpoints
- `GET /v1/servers`
- `GET /v1/servers/:serverId/channels`
- `GET /v1/channels/:channelId/messages`
- `POST /v1/channels/:channelId/messages`
