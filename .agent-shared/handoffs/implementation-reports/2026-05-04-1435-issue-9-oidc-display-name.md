# Issue #9 — Multiple OIDC Accounts "Guest" Issue

## What changed

- `apps/control-plane/src/auth/oidc.ts` — added a required `displayName: string | null`
  to the `OidcProfile` interface and populated it in all three exchange functions:
  - Discord: `profile.global_name ?? profile.username` (Discord's modern display name,
    falling back to the legacy username).
  - Google: `profile.name`.
  - Twitch: `profile.display_name ?? profile.login`.
- `apps/control-plane/src/services/identity-service.ts` — `upsertIdentityMapping`
  now accepts an optional `displayName`. The seed value for the insert is the
  caller-provided `displayName` if any, but the existing inheritance check still
  wins when a prior identity row for the same `product_user_id` has a non-null
  `display_name` (so user-edited values survive a relink). The `display_name`
  column's existing `coalesce` ON CONFLICT clause is unchanged.
- `apps/control-plane/src/routes/auth-routes.ts` — both the `intent="link"` and
  the `intent="login"` (no existing identity) callback paths now pass
  `displayName: profile.displayName` into `upsertIdentityMapping`.
- `apps/web/components/layout/ClientTopbar.tsx:72` — fallback chain for the
  topbar greeting is now `preferredUsername ?? displayName ?? "Guest"`.

PR: <https://github.com/SecareLupus/Skerry/pull/91>
Branch: `fix/issue-9-oidc-display-name` (commit `0ea2018`).

## Why

Per issue #9: a user who creates an account via Discord and links Twitch later
sees "Guest" in the topbar after signing in via Twitch, even though the Twitch
profile carries a perfectly good display name. Two contributing causes:

1. The `OidcProfile` shape didn't carry a `displayName` at all, so no provider's
   profile populated `identity_mappings.display_name`. The column was always
   null unless the user explicitly edited it from the profile editor.
2. `ClientTopbar` only rendered `preferredUsername`, with no secondary fallback,
   so any user whose `preferredUsername` was null on the resolved identity
   (most plausible cause: the user linked Twitch before completing onboarding,
   or hit the no-matching-email path on a fresh login) saw the literal string
   "Guest".

The fix populates `display_name` from each provider on first insert and gives
the topbar a sensible second-choice value to render.

## Root-cause recap

`/auth/session/me` resolves the viewer identity via `getIdentityByProductUserId`,
which orders by `(preferred_username is not null) desc, updated_at desc`. When
a user has at least one row with `preferred_username` set, that row is picked
and the topbar shows the chosen username — Discord-first users see this and
report no problem. The pathological cases:

- The user linked the second provider before onboarding completed; both rows
  had `preferred_username = null` at the time of link. After onboarding,
  `setPreferredUsernameForProductUser` does update all rows, so this should
  self-heal — but in the field, this code path has produced "Guest" reports.
- The user clicked "Login with Twitch" (rather than going through the link
  flow) and Twitch's email didn't match Discord's, so
  `findUniqueProductUserIdByEmail` returned null and a brand-new
  `productUserId` was minted with no `preferred_username` and no inheritance
  from the original Discord row.

In both cases the resolved identity's `displayName` was null too — because no
provider was capturing it. The first half of the fix closes that gap. The
second half (the topbar fallback chain) means even if a future code path
somehow leaves both `preferred_username` and `display_name` null, the user at
least sees something other than "Guest" once a provider name lands.

## Tests

- No new automated tests in this PR. The bug requires a real two-provider OIDC
  setup (or an extensively mocked one) to reproduce end-to-end, and the fix
  is small and isolated.
- **Typecheck:** `pnpm --filter @skerry/control-plane exec tsc --noEmit` and
  `pnpm --filter @skerry/web exec tsc --noEmit` both clean for the changed
  files. Pre-existing unrelated TS errors in `link-service.ts` and
  `embed-card.tsx` remain (untouched by this change).
- **Did NOT run:** the unit test suite, the E2E suite, or the docker test
  stack. Flagging this explicitly so the next agent (or reviewer) knows to
  exercise the actual link-and-relogin path before closing the issue.

## Open issues / follow-ups

- **Manual verification needed:** the test plan in PR #91 lists the two
  scenarios that should be exercised against a real OIDC setup (Discord-first
  with Twitch link; new-user Twitch login). The `pangolin` test server is the
  natural place to verify since it has real OIDC credentials configured.
- **Downstream concern, not addressed here:** when `intent="login"` with no
  existing linked identity and no email match, the system silently creates a
  brand-new account. This is arguably the *real* bug behind some "Guest"
  reports — users end up with two productUserIds rather than the link they
  intended. Out of scope for #9; worth a separate ticket if it isn't already
  filed.
- **Schema note:** the `display_name` column already existed; we're just
  populating it now. No migration was needed.

## Verification

- Verified on **localhost** (the development machine — see CONTEXT.md): the
  edits typecheck cleanly. End-to-end OIDC flow was *not* exercised because
  the test stack wasn't brought up; this is documented above as a follow-up
  for whoever closes the issue.
- Not yet verified on `pangolin`. PR #91 should be deployed there for the
  real-OIDC manual test before merge.
