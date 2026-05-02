---
name: bug-fix-test
description: Use when fixing a reported bug in Skerry. Confirms which machine the report came from, finds and matches existing test style, writes a failing regression test before the fix, runs the suite, and writes an implementation report. Invoke when the user reports a bug or asks for a fix that should land with a test.
---

# Bug Fix with Test Workflow

1. **Read context.** If you haven't already this session, read
   `.agent-shared/CONTEXT.md` and the relevant skill in `.agents/rules/`.
2. **Triage origin.** Confirm whether the bug was reported from localhost,
   the testing machine, or production. Don't assume — ask if unclear.
   - If from a non-local machine: gather logs/state from that host first.
     Don't cite local docker logs as evidence unless a matching local run
     exists.
3. **Locate existing tests.** Use `rg`/`glob` to find tests for the affected
   module. The relevant directories are:
   - `apps/control-plane/src/test/` — control-plane unit/integration (`tsx --test`)
   - `apps/web/test/` — web unit (`tsx --test`)
   - `apps/web/e2e/` — Playwright E2E
   - `packages/shared/src/test/` — shared package unit
4. **Match style.** Read 2–3 nearby tests. Follow the same framework
   (`node:test` + `node:assert` for unit; Playwright for E2E), fixture
   pattern, naming, and assertion style. If a parametrized helper exists,
   ADD a case to it rather than creating a new file.
5. **Pick the right level.** Unit > integration > E2E. For real-time
   features (messages, typing, presence, bridge), E2E is mandatory per
   `.agents/rules/real-time-validation.md`.
6. **Write the failing test first.** Run it. Confirm it fails for the
   *right* reason (the actual bug, not a setup error).
7. **Implement the fix.**
8. **Run the suite.** At minimum the affected workspace's `pnpm test`. For
   anything touching the real-time loop, also `pnpm test:e2e`. See
   `.agent-shared/TESTING.md` for the full command table.
9. **Write the implementation report** to
   `.agent-shared/handoffs/implementation-reports/YYYY-MM-DD-HHMM-<slug>.md`
   per the format in `.agent-shared/WORKFLOW.md`.
10. **Update the plan.** Edit `.agent-shared/handoffs/current-plan.md` and
    set `next_agent` appropriately.
