# Claude Code Project Instructions — Skerry

You are working in the Skerry monorepo. The project's engineering guardrails,
repository conventions, and validation checklist live in
[`AGENTS.md`](AGENTS.md), which is shared with Antigravity (Gemini).

## Imported Context

@.agent-shared/CONTEXT.md
@.agent-shared/WORKFLOW.md
@.agent-shared/TESTING.md

## Repository Skills

These project-specific skills are in `.agents/rules/` and apply when their
trigger conditions match:

- [`.agents/rules/bridge-mapping.md`](.agents/rules/bridge-mapping.md) — Discord/Matrix bridge consistency
- [`.agents/rules/component-decomposition.md`](.agents/rules/component-decomposition.md) — web components under 500 lines
- [`.agents/rules/contract-first.md`](.agents/rules/contract-first.md) — `@skerry/shared` as source of truth
- [`.agents/rules/development-testing-production.md`](.agents/rules/development-testing-production.md) — machine role definitions
- [`.agents/rules/hierarchical-theming.md`](.agents/rules/hierarchical-theming.md) — theme tokens, no hardcoded colors
- [`.agents/rules/real-time-validation.md`](.agents/rules/real-time-validation.md) — mandatory E2E for real-time features

## Cross-Agent Notes

- You share `.agent-shared/handoffs/` with Antigravity. Before ending a
  session that produced any non-trivial change, follow the handoff rules in
  `WORKFLOW.md`.
- When the user says "hand this off to Antigravity" or similar, use the
  `/handoff` slash command (or invoke the `handoff` skill).
- When investigating a reported bug, default to the `bug-fix-test` skill —
  it enforces the triage and test-first discipline described in
  `CONTEXT.md` and `TESTING.md`.

## Iteration Surface

When the user asks to add or change a cross-agent rule, edit the relevant
file under `.agent-shared/` and append an entry to
`.agent-shared/CHANGELOG.md` explaining what changed and why. For
project-specific rules, edit the matching file under `.agents/rules/`
instead.
