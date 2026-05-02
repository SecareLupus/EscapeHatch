---
created_by: claude-code
last_updated: 2026-05-02
next_agent: either
status: complete
---

# Plan: Bootstrap cross-agent shared workflow

## Goal
Stand up the `.agent-shared/` directory and per-agent reference files so that
Claude Code and Antigravity (Gemini) operate from a single source of truth
for environment context, handoff protocol, and testing discipline.

## Steps
- [x] Scaffold `.agent-shared/` (CONTEXT, WORKFLOW, TESTING, CHANGELOG, handoffs/)
- [x] Extend `AGENTS.md` to reference shared files (preserving existing Skerry guardrails)
- [x] Create `CLAUDE.md` with `@`-imports and pointers to `.agents/rules/`
- [x] Add Claude skills: `bug-fix-test`, `handoff`, `verify-environment`
- [x] Add slash commands: `/handoff`, `/verify-env`
- [x] Confirm public test/production server details in `.agent-shared/CONTEXT.md` (URL + LAN SSH IP)
- [ ] **User action**: skim `AGENTS.md` and `CLAUDE.md` and adjust the agent-specific notes if desired

## Open Questions
- Should Antigravity get a parallel `.gemini/skills/` tree, or is the `AGENTS.md` + `.agent-shared/` reference enough? (Currently leaning on the latter; can add later.)

## Blocking Issues
None.
