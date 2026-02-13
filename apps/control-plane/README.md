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
