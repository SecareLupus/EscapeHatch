# Web App Architecture

## Ownership boundary
- Hosted product shell and UX for creator co-op collaboration.
- Presents auth entrypoints and viewer session state from control-plane.
- Remains free of privileged direct Synapse admin operations.

## Extension points
- `app/`: route-level composition and data loading.
- `components/`: Discord-like shell, future timeline/moderation widgets.
- `lib/`: control-plane API client helpers and typed DTO adapters.

## Milestone alignment
- Milestone 0: social-login-first UX (`Sign in with Discord`).
- Milestone 1: consume server/channel domain APIs when channel management UI lands.
