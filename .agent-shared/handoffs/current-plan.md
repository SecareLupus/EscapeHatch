---
created_by: claude-code
last_updated: 2026-05-04T18:35:00Z
next_agent: either
status: in-progress
---

> **Note (2026-05-04 14:35):** Sprint 2 kicked off. Issue #9 (Multiple OIDC
> Accounts "Guest" Issue) landed on `fix/issue-9-oidc-display-name`,
> commit `0ea2018`, PR #91 open against `main`. Implementation report at
> `implementation-reports/2026-05-04-1435-issue-9-oidc-display-name.md`.
> Agent (claude-code) failed to read `.agent-shared/` at session start
> and proceeded as if no prior cross-agent protocol existed; the user
> caught this and the agent course-corrected mid-session. Subsequent
> Sprint 2 work should follow the protocol from the start.

# Plan: Skerry MVP Sprint 2

## Goal
Land all four Sprint 2 issues from GitHub Project #2 (`Skerry MVP Sprint
Plan`), one PR per issue. The user is near a weekly model-usage cap, so
**no batching, no overlapping branches**.

## Steps

- [x] **Issue #9** — Multiple OIDC Accounts "Guest" Issue.
  Done by claude-code (PR #91, branch `fix/issue-9-oidc-display-name`).
  See `implementation-reports/2026-05-04-1435-issue-9-oidc-display-name.md`.

- [ ] **Issue #23** — Invite Link Buttons Do Not Currently Generate Links.
  **NEXT** — assigned to: either.
  - Context: Per the issue body, two features are missing:
    (a) optional default role baked into an invite (space-admin use case);
    (b) optional default server placement on join. The most recent owner
    comment (2026-05-02) confirms invites grant server access for
    logged-in users; remaining work is the broader "permissions & invites"
    cleanup. The `hub_invites` table currently has no `role` or
    `server_id` columns (see
    `apps/control-plane/src/services/chat/server-service.ts` ~L248-266).
    The redeem page at `apps/web/app/invite/[inviteId]/page.tsx` does not
    handle logged-out visitors gracefully — clicking Accept while logged
    out hits a 401 with no login redirect. The "Create Hub Invite" modal
    in `apps/web/components/modals/InviteModals.tsx` is titled "Invite to
    {serverName}" but creates a hub-level invite.
  - Recommended slicing (one slice per PR, do not batch):
    - **Slice A (recommended first):** Fix the unauthenticated redeem
      flow (login redirect with return-to, then auto-trigger join after
      auth) and correct the modal title copy. Small, user-visible,
      no schema change.
    - **Slice B:** Schema migration adds `default_role` and
      `default_server_id` to `hub_invites`; create-invite UI exposes
      optional dropdowns; redeem applies them. Medium scope, separate
      PR.
    - **Slice C:** Broader permissions/invites cleanup. Out of scope
      for one PR — leave for a follow-up ticket.
  - Acceptance: PR open against `main`, branch
    `fix/issue-23-<slice-name>`, typecheck clean, manual repro
    documented. Mark this step `[x]` per slice landed; if all three
    slices are needed, expand this step into A/B/C sub-items.

- [ ] **Issue #34** — Onboarding Display Name. Pending.
  - Context: Not yet investigated this session. Read the issue + code
    before scoping.

- [ ] **Issue #38** — Changing Server Permissions Does Not Update Backend.
  Pending.
  - Context: Not yet investigated this session. Read the issue + code
    before scoping.

## Open Questions

- For #23: which slice does the user want first? Slice A is the
  recommended start (smallest, fixes a visible regression), but the
  user has not yet confirmed. Default to Slice A if the user does not
  pick one.
- Should the "two productUserIds when emails differ" downstream concern
  noted in the #9 report be filed as a separate issue?

## Blocking Issues

None.
