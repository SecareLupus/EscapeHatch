---
description: Confirm which machine we're on and which machine any cited evidence came from, before acting on a bug report.
---

Run the verify-environment skill at `.claude/skills/verify-environment/SKILL.md`:

1. Re-read `.agent-shared/CONTEXT.md`.
2. Confirm the current machine.
3. If $ARGUMENTS describes an issue or piece of evidence, determine which
   machine it came from (localhost, testing, production) and ask me if
   ambiguous.
4. If `.agent-shared/handoffs/current-plan.md` exists, surface its
   `next_agent` field.
