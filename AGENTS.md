# AGENTS.md

## Project scope
These instructions apply to the entire repository.

## Mission
Build a Matrix-based Creator Co-Op Hub platform with Discord-like semantics (servers, channels, scoped moderation, voice), following `creator_co_op_hub_chat_platform_project_spec_reference_architecture.md`.

## Engineering guardrails
- Keep architecture decisions aligned with the spec milestones.
- Prefer incremental, composable scaffolding over large rewrites.
- Keep the control plane as the policy gate for privileged operations.
- Do not grant raw homeserver-admin semantics to creator-level roles.

## Repository conventions
- Monorepo uses pnpm workspaces:
  - `apps/web`: hosted web client (Next.js)
  - `apps/control-plane`: provisioning/policy API
  - `packages/shared`: shared types/contracts
- Keep shared domain contracts in `packages/shared` and consume them in apps.
- Favor strict TypeScript settings and avoid `any`.

## Validation checklist for contributors
Before submitting changes, run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

If dependencies are missing, install with `pnpm install` first.
