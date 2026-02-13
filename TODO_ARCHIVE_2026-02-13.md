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
**Status:** Complete (MVP)

### Tasks
- [x] Align root scripts and workspace scripts so `pnpm dev/lint/typecheck/build/test` work consistently across packages.
- [x] Add/standardize environment templates (`.env.example`) for web/control-plane and infra integration.
- [x] Add architecture README pages per app/package with ownership boundaries and extension points.
- [x] Add CI workflow for `lint`, `typecheck`, `build` on pull requests.
- [x] Add basic test harness setup (unit + API contract tests) and initial smoke coverage.
- [x] Expand integration/API coverage from unauthenticated/error-path checks to authenticated flows:
  - dev login/session bootstrap,
  - hub/space/room provisioning,
  - permission and moderation gate assertions.

### Exit criteria
- New contributor can clone, install, run app services, and pass checks with documented commands.

---

## Phase 2 — Identity, Auth, and Session Foundation (Milestone 0 alignment)
**Goal:** Deliver OIDC-first login path and identity mapping between product and Matrix actors, with Discord SSO as the primary provider from day one.
**Status:** Complete (MVP)

### Tasks
- [x] Implement OIDC login flow in web app with **Discord as the default/primary SSO path** (social login first UX).
- [x] Configure IdP brokering so Discord identities flow through the chosen OIDC provider pattern:
  - Option A (preferred if we need centralized policy): Keycloak brokered to Discord, then Synapse + apps trust Keycloak OIDC.
  - Option B (fallback): direct Discord OIDC for product auth where appropriate, while preserving a unified identity mapping model.
- [x] Configure Synapse OIDC settings for JIT user provisioning with stable claims mapping (`sub`, `email`, `preferred_username`, avatar as available).
- [x] Add control-plane identity mapping model (`provider`, `oidc_subject` ↔ `matrix_user_id` ↔ product user profile) so multi-provider expansion does not require schema rewrites.
- [x] Add auth middleware in control-plane for scoped access control groundwork.
- [x] Add session/token handling strategy for web ↔ control-plane APIs, including token refresh, logout propagation, and session revocation hooks.
- [x] Define account-linking UX requirements for future provider expansion (Google/GitHub/etc.) without breaking Discord-first sign-in.

### Exit criteria
- User can authenticate via Discord SSO through OIDC and be recognized in both web client and control-plane identity context.
- Identity model supports at least one additional provider without structural redesign (even if not fully enabled yet).

---

## Phase 3 — Matrix Provisioning Adapter + Server/Channel Domain Model (Milestone 1 core)
**Goal:** Move from mock/bootstrap endpoints to real provisioning orchestration.
**Status:** Complete (MVP)

### Tasks
- [x] Define shared contracts for Hub, Server (Space), Channel (Room), Category (Subspace), and role mapping.
- [x] Add persistence layer (PostgreSQL) for platform entities and Matrix ID mappings.
- [x] Build control-plane adapters for Synapse admin/client APIs:
  - create server (space),
  - create channel (room),
  - attach rooms to spaces/subspaces,
  - set safe defaults (join rules/history visibility).
- [x] Replace `POST /bootstrap/channel` semantics with versioned domain APIs (`/servers`, `/channels`).
- [x] Add idempotency and retry/error handling for provisioning workflows.
- [x] Add discovery-state contracts and storage needed for Discord-like channel navigation:
  - unread-by-channel persistence,
  - mention/highlight markers consumable by web UI.

### Exit criteria
- Creator server and text channels are created through control-plane and reflected as real Matrix entities.

---

## Phase 4 — Authorization, Roles, and Scoped Moderation Gate (Milestone 1–2 bridge)
**Goal:** Enforce policy that creator roles never get raw homeserver-admin privileges.
**Status:** Complete (MVP)

### Tasks
- [x] Implement RBAC/ABAC policy engine in control-plane:
  - Hub Operator,
  - Creator Admin,
  - Creator Moderator,
  - Member.
- [x] Add permission matrix for server/channel actions (create, moderate, invite, lock, etc.).
- [x] Introduce “privileged action gateway” service layer so all moderation/admin actions route through policy checks.
- [x] Store audit envelope for all privileged operations (actor, target, scope, reason, timestamp).
- [x] Add negative tests proving cross-scope moderation is rejected.

### Exit criteria
- Privileged operations are only executable through scoped control-plane policies and are auditable.

---

## Phase 5 — Moderation Toolkit MVP (Milestone 2)
**Goal:** Ship creator-scoped moderation features with operational visibility.
**Status:** Complete (MVP)

### Tasks
- [x] Implement moderation APIs/UI for kick, ban/unban, timeout, and message redaction patterns.
- [x] Implement channel controls: lock/unlock, slow mode, and posting/media restrictions.
- [x] Add reports intake pipeline (report creation, triage queue, status transitions).
- [x] Build audit log query endpoints and basic moderation dashboard views.
- [x] Add moderation event schemas in `packages/shared` consumed by both apps.

### Exit criteria
- Creator mods can perform scoped moderation actions, with reports and audit trails visible in product UI.

---

## Phase 6 — Voice Channel Foundation with SFU (Milestone 3)
**Goal:** Enable reliable small-group voice experience tied to Matrix room semantics.
**Status:** Complete (MVP)

### Tasks
- [x] Extend channel model with `voice` metadata and `sfu_room_id` bindings.
- [x] Implement control-plane endpoint for short-lived SFU token issuance with scope validation.
- [x] Integrate SFU client SDK in web app for join/leave/mute/deafen controls.
- [x] Add voice roster presence model (lightweight sync into UI; minimal Matrix state writes).
- [x] Validate TURN path and fallback behavior in local infrastructure.

### Exit criteria
- Users can join voice channels and communicate via SFU with scoped token issuance.

---

## Phase 7 — Federation Policy Enforcement for Managed Hub Network
**Goal:** Default to hub-restricted federation and safe room-level ACL posture.
**Status:** Complete (MVP)

### Tasks
- [x] Add federation allowlist configuration model at hub level.
- [x] Apply server ACL defaults (`m.room.server_acl` or equivalent) on system-created rooms.
- [x] Build control-plane routines to reconcile policy drift on existing rooms/spaces.
- [x] Add admin visibility for current federation policy status and recent changes.
- [x] Add integration tests for allowlisted vs non-allowlisted federation interactions.

### Exit criteria
- System-created rooms enforce managed-network federation boundaries by default.

---

## Phase 8 — Discord Bridge MVP (Milestone 4)
**Goal:** Connect creator Discord communities with mapped Matrix rooms through controlled workflows.
**Status:** Complete (MVP scaffolding)

### Tasks
- [x] Implement “Connect Discord” OAuth flow and guild selection UX, reusing identity/session patterns established in Phase 2 where feasible.
- [x] Integrate selected bridge implementation (evaluate matrix-appservice-discord vs mautrix-discord fit).
- [x] Build channel mapping management UI/API (Discord channel ↔ Matrix room).
- [x] Ship basic message/media relay with documented formatting limitations.
- [x] Add bridge health + sync status visibility and retry actions for admins.

### Exit criteria
- Creator admins can connect a guild, map channels, and observe bidirectional message relay.

---

## Phase 9 — Video Enablement, Performance, and Production Readiness (Milestone 5 + hardening)
**Goal:** Optional video support plus operational quality required for hosted rollout.
**Status:** Complete (MVP hardening)

### Tasks
- [x] Enable optional video tracks and bandwidth/quality controls in voice channels.
- [x] Add observability stack glue (metrics/logging/error tracking hooks from apps and infra services).
- [x] Extend request tracing from per-response correlation IDs to persistent sinks:
  - structured log shipping with `requestId`,
  - traceable error reporting across web + control-plane.
- [x] Define backup/retention policies (Postgres/media) and runbook docs.
- [x] Add load/concurrency validation for expected usage profile (small active cohorts).
- [x] Perform security hardening review (rate limits, token TTLs, secret management, audit integrity).

### Exit criteria
- Platform supports stable hosted operation with optional video and operational safeguards.

---

## Suggested implementation cadence
- Start by delivering Phases 1–3 sequentially to complete practical Milestone 0/1 foundations.
- Run Phases 4–6 as an integrated stream (policy gate + moderation + voice).
- Execute Phases 7–9 once core product loop is stable and measurable.
