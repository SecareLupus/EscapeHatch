---
name: handoff
description: Use when ending a working session that should be picked up by Antigravity (Gemini) or by a future Claude Code session. Updates the shared plan, appends to the chat log, and writes an implementation report. Invoke when the user says "hand this off", "let Gemini take it from here", "wrap up for now", or similar.
---

# Cross-Agent Handoff

The full protocol lives in `.agent-shared/WORKFLOW.md`. Steps:

1. **Update `.agent-shared/handoffs/current-plan.md`:**
   - Mark steps you completed with `[x]` and link to your implementation
     report.
   - Add or revise upcoming steps based on what you learned.
   - Set `next_agent` to `claude-code`, `antigravity`, or `either`. If the
     user named a target ("hand off to Gemini"), use that. Otherwise infer
     from the next step.
   - Update `last_updated` and `status`.
2. **Write an implementation report** for any non-trivial change to
   `.agent-shared/handoffs/implementation-reports/YYYY-MM-DD-HHMM-<slug>.md`.
   Required sections: What changed, Why, Tests (added/run/results), Open
   issues, Verification (which machine).
3. **Append a one-paragraph summary** to
   `.agent-shared/handoffs/chat-log.md` with `## YYYY-MM-DD HH:MM — claude-code`
   header.
4. If you added or modified anything under `.agent-shared/` itself, append
   a one-line entry to `.agent-shared/CHANGELOG.md`.
5. Tell the user what you did and which agent should pick up next.
