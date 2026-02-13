# Operations Runbook

## Scope
- Control-plane API reliability, tracing, backups, and bridge/federation posture.

## Logging and Traceability
- Every response carries `x-request-id`.
- Control-plane emits structured JSON logs with `requestId` and route metadata.
- Set `LOG_FILE_PATH` to persist logs to disk for ingestion/shipping.

## Backup and Retention
- Postgres:
  - Daily full backup.
  - Point-in-time WAL archiving if available in host environment.
  - Retention: 14 days minimum.
- Media/attachments:
  - Retain source object storage snapshots for 7 days minimum.
  - Validate restore paths monthly.

## Security Hardening Checklist
- Configure `SESSION_SECRET` and `SFU_TOKEN_SECRET` with high-entropy values.
- Keep `SESSION_TTL_SECONDS` and `SFU_TOKEN_TTL_SECONDS` short and environment-specific.
- Keep `RATE_LIMIT_PER_MINUTE` enabled in production.
- Restrict OAuth callback URLs to exact known hosts.
- Review moderation/audit tables for append-only expectations and operational alerts.

## Federation Policy Operations
- Set hub federation allowlist in UI/API.
- Run reconciliation after policy changes to re-apply ACLs to existing spaces/rooms.
- Investigate `room_acl_status` entries with `status=error`.

## Discord Bridge Operations
- Use mock mode (`DISCORD_BRIDGE_MOCK=true`) for local validation.
- In production, disable mock mode and provide OAuth credentials.
- After guild connect or mapping updates, run bridge sync retry.

## Load/Concurrency Validation
- Run `pnpm test`, `pnpm typecheck`, `pnpm build` on every deployment candidate.
- Execute synthetic message burst and voice-join concurrency tests in staging prior to release.
