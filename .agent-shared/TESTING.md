# Testing Rules

Shared between Claude Code and Antigravity. Stack-specific commands are at
the bottom; the discipline above the line is universal.

## Bug Fixes Require Tests

When fixing a bug:

1. Decide whether the bug is reasonably testable. Most are; flag the
   exceptions explicitly in the implementation report rather than silently
   skipping.
2. Locate existing tests for the affected module. Use `rg`/`glob` to find
   files in the relevant `test/` or `e2e/` directory.
3. **Match the existing style.** Do not introduce a new framework, fixture
   pattern, or assertion library because it's what you'd reach for first.
   - If the suite uses `tsx --test` (the Node test runner), use that.
   - If a parametrized helper or table already exists for similar cases,
     ADD to it rather than creating a new test file.
   - Read 2–3 nearby tests before writing yours.
4. Choose the right level: unit > integration > E2E. Prefer the lowest
   level that actually catches the regression.
5. Write the test FIRST, run it, confirm it fails for the *right reason*,
   then implement the fix.

## When E2E Is Required

Per [`.agents/rules/real-time-validation.md`](../.agents/rules/real-time-validation.md),
any feature touching the real-time loop (User → Control Plane → Synapse →
SSE → Frontend) **must** include or update a Playwright E2E test. Examples:
messages, typing indicators, presence, bridge status, reactions.

Do not mock Matrix or SSE in E2E. Do not mock the Discord WS gateway in any
test (REST mocks via fake-discord are OK; WS gateway is tested manually).

## Definition of "Complete"

A task is not complete until **all** of these hold:

- [ ] Code change is made.
- [ ] New or updated tests exist where applicable (or the exception is
      documented).
- [ ] The relevant test suite has been run on **localhost** (the development
      machine — see `CONTEXT.md`).
- [ ] All tests pass, OR failures are explicitly documented as pre-existing
      and unrelated, with evidence (e.g. failed before your change too).
- [ ] An implementation report has been written to
      `.agent-shared/handoffs/implementation-reports/`.
- [ ] `.agent-shared/handoffs/current-plan.md` has been updated.

If the suite cannot be run locally for some reason (e.g. test stack won't
start), STOP and surface this to the user rather than declaring complete.

## Skerry Test Commands

Run from the repo root unless noted:

| Scope | Command |
| --- | --- |
| All workspace unit tests | `pnpm test` |
| Shared package unit | `pnpm --filter @skerry/shared test` |
| Control-plane unit/integration | `pnpm --filter @skerry/control-plane test` |
| Web unit | `pnpm --filter @skerry/web test` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Build | `pnpm build` |
| Test stack up (Docker, for E2E) | `pnpm test:env:up` |
| Test stack down | `pnpm test:env:down` |
| E2E (Playwright) | `pnpm test:e2e` |
| E2E with reset | `pnpm test:e2e:run` |
| Full pre-submit | `pnpm test:all` |

The validation checklist from `AGENTS.md` (lint, typecheck, build, test) is
the minimum bar before any submission.

### Test framework notes

- Unit/integration suites use the **Node test runner** (`tsx --test`), not
  Vitest or Jest, despite what older notes may say. Match the existing
  `node:test` + `node:assert` style.
- E2E uses **Playwright** in `apps/web/e2e/`. Use auto-retrying assertions
  (`expect(locator).toBeVisible()`); avoid hardcoded `setTimeout`s.
- Control-plane tests run with `--test-concurrency=1` and require the test
  DB setup (`src/test/setup-test-db.ts`). Don't parallelize them.
