# TODO — Creator Co-Op Hub Platform Development Phases

This roadmap maps the current repository scaffold to the target architecture in `creator_co_op_hub_chat_platform_project_spec_reference_architecture.md`.

## Current state snapshot
- Monorepo scaffolding exists for:
  - hosted web shell (`apps/web`),
  - control-plane API bootstrap (`apps/control-plane`),
  - shared contracts package (`packages/shared`).
- Bootstrap APIs exist for health checks, default server blueprint retrieval, and basic channel creation request validation.
- Shared role/channel contracts are present but still MVP/minimal.
- Local infra composition is present for Synapse, Postgres, Keycloak, LiveKit, and coturn.

---

## Phase 1 — Platform Baseline & Developer Workflow Hardening
**Goal:** Ensure every contributor can reliably run, lint, typecheck, build, and understand boundaries.

### Tasks
- Align root scripts and workspace scripts so `pnpm dev/lint/typecheck/build/test` work consistently across packages.
- Add/standardize environment templates (`.env.example`) for web/control-plane and infra integration.
- Add architecture README pages per app/package with ownership boundaries and extension points.
- Add CI workflow for `lint`, `typecheck`, `build` on pull requests.
- Add basic test harness setup (unit + API contract tests) and initial smoke coverage.

### Exit criteria
- New contributor can clone, install, run app services, and pass checks with documented commands.

---

## Phase 2 — Identity, Auth, and Session Foundation (Milestone 0 alignment)
**Goal:** Deliver OIDC-first login path and identity mapping between product and Matrix actors, with Discord SSO as the primary provider from day one.

### Tasks
- Implement OIDC login flow in web app with **Discord as the default/primary SSO path** (social login first UX).
- Configure IdP brokering so Discord identities flow through the chosen OIDC provider pattern:
  - Option A (preferred if we need centralized policy): Keycloak brokered to Discord, then Synapse + apps trust Keycloak OIDC.
  - Option B (fallback): direct Discord OIDC for product auth where appropriate, while preserving a unified identity mapping model.
- Configure Synapse OIDC settings for JIT user provisioning with stable claims mapping (`sub`, `email`, `preferred_username`, avatar as available).
- Add control-plane identity mapping model (`provider`, `oidc_subject` ↔ `matrix_user_id` ↔ product user profile) so multi-provider expansion does not require schema rewrites.
- Add auth middleware in control-plane for scoped access control groundwork.
- Add session/token handling strategy for web ↔ control-plane APIs, including token refresh, logout propagation, and session revocation hooks.
- Define account-linking UX requirements for future provider expansion (Google/GitHub/etc.) without breaking Discord-first sign-in.

### Exit criteria
- User can authenticate via Discord SSO through OIDC and be recognized in both web client and control-plane identity context.
- Identity model supports at least one additional provider without structural redesign (even if not fully enabled yet).

---

## Phase 3 — Matrix Provisioning Adapter + Server/Channel Domain Model (Milestone 1 core)
**Goal:** Move from mock/bootstrap endpoints to real provisioning orchestration.

### Tasks
- Define shared contracts for Hub, Server (Space), Channel (Room), Category (Subspace), and role mapping.
- Add persistence layer (PostgreSQL) for platform entities and Matrix ID mappings.
- Build control-plane adapters for Synapse admin/client APIs:
  - create server (space),
  - create channel (room),
  - attach rooms to spaces/subspaces,
  - set safe defaults (join rules/history visibility).
- Replace `POST /bootstrap/channel` semantics with versioned domain APIs (`/servers`, `/channels`).
- Add idempotency and retry/error handling for provisioning workflows.

### Exit criteria
- Creator server and text channels are created through control-plane and reflected as real Matrix entities.

---

## Phase 4 — Authorization, Roles, and Scoped Moderation Gate (Milestone 1–2 bridge)
**Goal:** Enforce policy that creator roles never get raw homeserver-admin privileges.

### Tasks
- Implement RBAC/ABAC policy engine in control-plane:
  - Hub Operator,
  - Creator Admin,
  - Creator Moderator,
  - Member.
- Add permission matrix for server/channel actions (create, moderate, invite, lock, etc.).
- Introduce “privileged action gateway” service layer so all moderation/admin actions route through policy checks.
- Store audit envelope for all privileged operations (actor, target, scope, reason, timestamp).
- Add negative tests proving cross-scope moderation is rejected.

### Exit criteria
- Privileged operations are only executable through scoped control-plane policies and are auditable.

---

## Phase 5 — Moderation Toolkit MVP (Milestone 2)
**Goal:** Ship creator-scoped moderation features with operational visibility.

### Tasks
- Implement moderation APIs/UI for kick, ban/unban, timeout, and message redaction patterns.
- Implement channel controls: lock/unlock, slow mode, and posting/media restrictions.
- Add reports intake pipeline (report creation, triage queue, status transitions).
- Build audit log query endpoints and basic moderation dashboard views.
- Add moderation event schemas in `packages/shared` consumed by both apps.

### Exit criteria
- Creator mods can perform scoped moderation actions, with reports and audit trails visible in product UI.

---

## Phase 6 — Voice Channel Foundation with SFU (Milestone 3)
**Goal:** Enable reliable small-group voice experience tied to Matrix room semantics.

### Tasks
- Extend channel model with `voice` metadata and `sfu_room_id` bindings.
- Implement control-plane endpoint for short-lived SFU token issuance with scope validation.
- Integrate SFU client SDK in web app for join/leave/mute/deafen controls.
- Add voice roster presence model (lightweight sync into UI; minimal Matrix state writes).
- Validate TURN path and fallback behavior in local infrastructure.

### Exit criteria
- Users can join voice channels and communicate via SFU with scoped token issuance.

---

## Phase 7 — Federation Policy Enforcement for Managed Hub Network
**Goal:** Default to hub-restricted federation and safe room-level ACL posture.

### Tasks
- Add federation allowlist configuration model at hub level.
- Apply server ACL defaults (`m.room.server_acl` or equivalent) on system-created rooms.
- Build control-plane routines to reconcile policy drift on existing rooms/spaces.
- Add admin visibility for current federation policy status and recent changes.
- Add integration tests for allowlisted vs non-allowlisted federation interactions.

### Exit criteria
- System-created rooms enforce managed-network federation boundaries by default.

---

## Phase 8 — Discord Bridge MVP (Milestone 4)
**Goal:** Connect creator Discord communities with mapped Matrix rooms through controlled workflows.

### Tasks
- Implement “Connect Discord” OAuth flow and guild selection UX, reusing identity/session patterns established in Phase 2 where feasible.
- Integrate selected bridge implementation (evaluate matrix-appservice-discord vs mautrix-discord fit).
- Build channel mapping management UI/API (Discord channel ↔ Matrix room).
- Ship basic message/media relay with documented formatting limitations.
- Add bridge health + sync status visibility and retry actions for admins.

### Exit criteria
- Creator admins can connect a guild, map channels, and observe bidirectional message relay.

---

## Phase 9 — Video Enablement, Performance, and Production Readiness (Milestone 5 + hardening)
**Goal:** Optional video support plus operational quality required for hosted rollout.

### Tasks
- Enable optional video tracks and bandwidth/quality controls in voice channels.
- Add observability stack glue (metrics/logging/error tracking hooks from apps and infra services).
- Define backup/retention policies (Postgres/media) and runbook docs.
- Add load/concurrency validation for expected usage profile (small active cohorts).
- Perform security hardening review (rate limits, token TTLs, secret management, audit integrity).

### Exit criteria
- Platform supports stable hosted operation with optional video and operational safeguards.

---

## Suggested implementation cadence
- Start by delivering Phases 1–3 sequentially to complete practical Milestone 0/1 foundations.
- Run Phases 4–6 as an integrated stream (policy gate + moderation + voice).
- Execute Phases 7–9 once core product loop is stable and measurable.
