---
name: verify-environment
description: Use when starting work in a fresh session, when the user reports an issue and the source machine is unclear, or when about to cite log evidence. Confirms which machine you're on and which machine the evidence in question came from.
---

# Verify Environment

1. Re-read `.agent-shared/CONTEXT.md` if not already in context this session.
2. Confirm the **current** machine (localhost is almost always the
   development machine — see `pwd`, `hostname` if unsure).
3. If the user mentioned an issue, logs, or a reproduction:
   - Ask explicitly: "Did this come from localhost, the testing machine, or
     production?" — unless context makes it unambiguous.
   - If the answer is non-local, plan to gather evidence from that host
     before reproducing locally. Do NOT use local docker logs as evidence
     for a non-local report.
4. If `.agent-shared/handoffs/current-plan.md` exists, read it and check
   the `next_agent` field. If it's not you or `either`, surface that to the
   user before proceeding.
