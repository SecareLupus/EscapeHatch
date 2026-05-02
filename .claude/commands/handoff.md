---
description: Update shared plan, write implementation report, append chat log, and set next_agent for handoff to Antigravity or future Claude session.
---

Run the full handoff protocol per `.claude/skills/handoff/SKILL.md` and
`.agent-shared/WORKFLOW.md`:

1. Update `.agent-shared/handoffs/current-plan.md` — mark completed steps,
   refresh `last_updated`, and set `next_agent` to: $ARGUMENTS
   (if `$ARGUMENTS` is empty, set it to `either`).
2. Write a full implementation report for this session's non-trivial
   changes to `.agent-shared/handoffs/implementation-reports/YYYY-MM-DD-HHMM-<slug>.md`.
3. Append a one-paragraph summary to `.agent-shared/handoffs/chat-log.md`.
4. If `.agent-shared/` files were modified, append a CHANGELOG entry.
5. Tell me what you wrote and which agent picks up next.
