# Environment Context

This file is shared between Claude Code and Antigravity (Gemini). It describes
the machines involved in development and testing of Skerry, and the triage
protocol when investigating reported issues.

The terminology here is the canonical extension of
[`.agents/rules/development-testing-production.md`](../.agents/rules/development-testing-production.md);
the rule file remains authoritative for the role definitions.

## Machine Roles

- **localhost / development machine** — where the agent is currently executing
  and where source edits happen. Almost always also the dev machine. Used for
  running unit tests and (via `pnpm test:env:up`) local integration / E2E.
  Docker logs here reflect ONLY local runs.
- **testing machine** — runs `git pull && docker compose down && docker compose up -d --build`
  on a recent commit. May or may not be localhost. If you receive error logs
  with no other context, default assumption is they came from this machine.
- **production machine** — final deployment target. May or may not coincide
  with the testing machine. Treat any change touching this with extra care.
  *Currently does not exist*: the project is pre-MVP and the `pangolin`
  test server is acting in a production-like role until a real one is
  stood up.

## Public-Facing Test Server (`pangolin`)

The project is pre-MVP, so there is **no real production server** yet.
The `pangolin` host is the publicly reachable test server, intended to
behave the way a production deployment eventually will — useful for
exercising HTTPS, real DNS, federation, and external bridges in a setting
that resembles production conditions without being it.

- **URL:** https://hatch.pangolin.showgroundslive.com (HTTPS, public)
- **SSH:** `ssh root@10.0.20.121` — the public URL itself is **not**
  SSH-reachable; use the LAN IP. The default identity file should
  authenticate.
- **Role:** testing machine, per the role definitions above. It is *not*
  production. Don't apply production-grade caution (e.g. avoiding
  destructive operations, enforcing change review) — but do apply the care
  appropriate to a host other people may be using to evaluate the product.
- **Runs:** latest or near-latest committed code, deployed via the standard
  `git pull && docker compose down && docker compose up -d --build` cycle.

When the user reports an issue without specifying a machine, default
assumption is that it occurred here, not on localhost.

## Issue Triage Protocol

When investigating a reported issue:

1. Ask (or infer from context) which machine the report came from. Don't
   assume localhost.
2. If it came from the testing or production machine, gather logs/state from
   **that** host before trying to reproduce locally. Do not consult local
   docker logs as evidence unless you've confirmed a matching run happened on
   localhost.
3. Reproduce locally before fixing, when feasible. If a local reproduction is
   not feasible, say so explicitly.
4. After fixing, follow `TESTING.md` to verify before declaring complete.
