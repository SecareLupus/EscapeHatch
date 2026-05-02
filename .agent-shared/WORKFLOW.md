# Cross-Agent Workflow

Shared between Claude Code and Antigravity (Gemini). Either agent may be
running at any time; neither sees the other's chat history. The handoff files
below are how state is passed between sessions.

## Shared State Files

- `.agent-shared/handoffs/current-plan.md` — the active plan with checkboxes.
  This is your **inbox** at session start and your **outbox** at session end.
- `.agent-shared/handoffs/chat-log.md` — append-only short summaries.
- `.agent-shared/handoffs/implementation-reports/YYYY-MM-DD-HHMM-<slug>.md` —
  a full report for any non-trivial change.
- `.agent-shared/CHANGELOG.md` — when *you* (the agent) add or change a rule
  in `.agent-shared/`, note it here with date + reason.

## Plan Format (current-plan.md)

```markdown
---
created_by: claude-code | antigravity
last_updated: <ISO-8601 timestamp>
next_agent: claude-code | antigravity | either
status: in-progress | blocked | complete
---

# Plan: <Title>

## Goal
<one paragraph>

## Steps
- [x] Step 1 — done by claude-code, see implementation-reports/2026-05-02-1430-step-1.md
- [ ] Step 2 — **NEXT** — assigned to: antigravity
  - Context: ...
  - Acceptance: ...
- [ ] Step 3 — pending

## Open Questions
- ...

## Blocking Issues
- ...
```

## Handoff Rules

1. **Before ending your turn**, update `current-plan.md`:
   - Mark completed steps with `[x]` and link to the implementation report.
   - Set `next_agent` to whoever should pick up next, or `either` if it
     genuinely doesn't matter.
   - Update the `last_updated` timestamp.
2. **Append a one-paragraph summary** to `chat-log.md` with your agent name,
   timestamp, and what you accomplished or got blocked on.
3. **Write a full implementation report** to
   `handoffs/implementation-reports/` for any non-trivial change.
   See "Report Contents" below.

## Picking Up a Handoff

At session start, after reading `CONTEXT.md`:

1. Read `current-plan.md` if it exists.
2. If `next_agent` is **you** or `either`, proceed with the next unchecked
   step.
3. If `next_agent` is the **other agent**, ask the user whether to proceed
   anyway or wait.
4. If no plan exists, treat the user's first message as the spec for a new
   plan. Write `current-plan.md` once the goal is clear.

## Report Contents

An implementation report MUST include:

- **What changed** — files touched, key diffs (in prose, not just paste).
- **Why** — link back to the plan step or user request.
- **Tests** — what was added/updated; what was run; results.
- **Open issues / follow-ups** — anything the next agent (or future you)
  needs to know that isn't already obvious from the diff.
- **Verification** — which machine the verification ran on (see CONTEXT.md
  role definitions).

The seam between agents is invisible only if reports are honest about what
was *not* done as well as what was.

## Describing Intent, Not Mechanism

When writing rules, plans, or reports, describe **intent** ("run the full
suite", "locate the existing tests for this module") rather than the exact
tool calls. Each agent has different shell wrappers and file-editing
primitives — let them use their native tooling.
