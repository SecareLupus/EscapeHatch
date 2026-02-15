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
**Status:** Completed
- [x] Enforce authorization on role assignment APIs so non-admin users cannot grant roles.
- [x] Add immutable role-assignment audit records (actor, target, scope, role, timestamp).
- [x] Add integration tests for role-grant denial/allow paths and escalation attempts.
- [x] Add explicit API error codes for delegation violations.

---

## Phase 10 — Delegation Domain Model + Ownership Semantics
**Goal:** Introduce first-class delegated administration for spaces/categories/rooms.
**Status:** Completed
- [x] Define explicit delegation contracts in `packages/shared`.
- [x] Add persistence model for assignments with lifecycle states (`active`, `revoked`, `expired`).
- [x] Introduce server ownership semantics.
- [x] Map role bindings to delegation assignments.
- [x] Add migration/backfill strategy (system-created hubs/servers initialized with owners).

---

## Phase 11 — Delegation Policy Engine + Secure APIs
**Goal:** Make delegated space administration enforceable through policy gates.
**Status:** Completed
- [x] Build dedicated delegation service methods.
- [x] Add policy rules for delegation operations.
- [x] Add scope-safe user-management endpoints for delegated admins (role mapping).
- [x] Add idempotency and conflict handling.
- [x] Emit delegation audit events for all assignment changes.

---

## Phase 12 — Admin UX for Delegation Workflows
**Goal:** Deliver complete management UX for assigning and reviewing delegated space administrators.
**Status:** In Progress

### Tasks
- [ ] Implement API client methods in `apps/web/lib/control-plane.ts`.
- [ ] Extend `/admin` with delegation console:
  - assign/revoke space admins,
  - ownership transfer flow,
  - effective permissions preview.
- [ ] Add searchable user picker and current-assignment table per hub/space.
- [ ] Show assignment history/audit timeline in UI.
- [ ] Add UI safety affordances.
- [ ] Add E2E happy-path + abuse-path UI tests.

---

## Phase 13 — Production Test Readiness for Delegation
**Goal:** Validate delegated administration under realistic operational conditions.
**Status:** Planned

