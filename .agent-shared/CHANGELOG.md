# `.agent-shared/` Changelog

When an agent (Claude Code or Antigravity) adds or modifies a rule in this
directory, append a one-line entry below with date, agent, file, and reason.
This is the institutional memory for *why* a rule exists once the originating
conversation is forgotten.

Format: `YYYY-MM-DD — <agent> — <file>: <change> — <reason>`

---

- 2026-05-02 — claude-code — initial scaffold of `.agent-shared/` (CONTEXT, WORKFLOW, TESTING) per cross-agent integration plan; references existing `.agents/rules/` skills rather than duplicating.
- 2026-05-02 — claude-code — CONTEXT.md: filled in confirmed public test/production server details (URL `hatch.pangolin.showgroundslive.com`, SSH via `root@10.0.20.121`); replaces the TODO placeholder.
- 2026-05-02 — claude-code — CONTEXT.md: clarified that the project is pre-MVP, no real production server exists yet, and `pangolin` is a public-facing test server *standing in for* production — not production itself.
