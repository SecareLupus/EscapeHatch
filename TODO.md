# TODO — Creator Co-Op Hub Platform: Delegated Space Administration Roadmap

This roadmap starts after Phases 1-9 MVP completion and focuses on production-ready space administration delegation.

## Archive
- Previous roadmap snapshot: `TODO_ARCHIVE_2026-02-13.md`

## Current Focus Snapshot
- Core auth, provisioning, moderation, voice, federation policy, Discord bridge scaffolding, and admin console exist.
- Next objective: make space administration delegation explicit, secure, auditable, and testable for production trials.

---

## Carry-Forward Hardening Items
**Goal:** Close critical gaps discovered while completing Phases 1-9.
**Status:** In Progress

### Tasks
- [ ] Enforce authorization on role assignment APIs so non-admin users cannot grant roles:
  - gate `POST /v1/roles/grant` behind scoped `hub_operator`/`creator_admin` checks,
  - prevent privilege escalation outside actor scope.
- [ ] Add immutable role-assignment audit records (actor, target, scope, role, timestamp).
- [ ] Add integration tests for role-grant denial/allow paths and escalation attempts.
- [ ] Add explicit API error codes for delegation violations (`forbidden_scope`, `role_escalation_denied`).

### Exit criteria
- Role delegation operations are policy-gated, auditable, and regression-tested.

---

## Phase 10 — Delegation Domain Model + Ownership Semantics
**Goal:** Introduce first-class delegated administration for spaces/categories/rooms.
**Status:** Planned

### Tasks
- [ ] Define explicit delegation contracts in `packages/shared`:
  - `SpaceAdminAssignment`,
  - `CategoryAdminAssignment` (optional, future-compatible),
  - `DelegationAuditEvent`.
- [ ] Add persistence model for assignments with lifecycle states (`active`, `revoked`, `expired`).
- [ ] Introduce server ownership semantics:
  - `owner_user_id` (or equivalent assignment link),
  - transfer ownership workflow with guardrails.
- [ ] Map role bindings to delegation assignments (source of truth reconciliation rules).
- [ ] Add migration/backfill strategy for existing hubs/servers.

### Exit criteria
- Space-level admin delegation is represented explicitly in contracts + DB and can be queried reliably.

---

## Phase 11 — Delegation Policy Engine + Secure APIs
**Goal:** Make delegated space administration enforceable through policy gates.
**Status:** Planned

### Tasks
- [ ] Build dedicated delegation service methods:
  - assign space admin,
  - revoke assignment,
  - transfer space ownership,
  - list effective admins per scope.
- [ ] Add policy rules for delegation operations:
  - only hub operators/owners can assign high-scope roles,
  - delegated admins can manage only assigned space scope.
- [ ] Add scope-safe user-management endpoints for delegated admins:
  - invite/add member to space,
  - remove member from space,
  - grant/revoke moderator/member within assigned space.
- [ ] Add idempotency and conflict handling (`already_assigned`, `assignment_conflict`, `owner_transfer_required`).
- [ ] Emit delegation audit events for all assignment changes.

### Exit criteria
- Delegated admins can manage only their assigned spaces/users, and all operations are policy-enforced + auditable.

---

## Phase 12 — Admin UX for Delegation Workflows
**Goal:** Deliver complete management UX for assigning and reviewing delegated space administrators.
**Status:** Planned

### Tasks
- [ ] Extend `/admin` with delegation console:
  - assign/revoke space admins,
  - ownership transfer flow,
  - effective permissions preview.
- [ ] Add searchable user picker and current-assignment table per hub/space.
- [ ] Show assignment history/audit timeline in UI.
- [ ] Add UI safety affordances:
  - confirmation prompts for revocation/transfer,
  - explicit scope badges,
  - warnings for high-impact actions.
- [ ] Add E2E happy-path + abuse-path UI tests.

### Exit criteria
- Product admins can manage delegation safely from UI without direct DB/API manipulation.

---

## Phase 13 — Production Test Readiness for Delegation
**Goal:** Validate delegated administration under realistic operational conditions.
**Status:** Planned

### Tasks
- [ ] Add staging test scenarios for multi-tenant hubs with overlapping delegations.
- [ ] Add concurrency tests for assignment races (simultaneous grant/revoke/transfer).
- [ ] Add negative security tests:
  - cross-space management attempts,
  - stale-session delegation abuse,
  - privilege escalation via crafted payloads.
- [ ] Add observability dashboards/alerts for delegation events and policy denials.
- [ ] Finalize rollout checklist:
  - migration order,
  - rollback path,
  - feature flag strategy.

### Exit criteria
- Delegation model is validated, observable, and safe for production pilot cohorts.

---

## Suggested Cadence
1. Carry-Forward Hardening Items
2. Phase 10 (modeling)
3. Phase 11 (enforcement APIs)
4. Phase 12 (admin UX)
5. Phase 13 (staging validation + rollout)
