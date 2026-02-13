# Web App Architecture

## Ownership boundary
- Hosted product shell and UX for creator co-op collaboration.
- Presents auth entrypoints and viewer session state from control-plane.
- Provides accessible local chat experience for bootstrap + messaging validation.

## Extension points
- `app/`: route-level composition.
- `components/chat-client.tsx`: interactive auth/bootstrap/chat UI state machine.
- `lib/`: control-plane API client helpers and typed DTO adapters.

## Current local UX
- Sign in with dev login (or configured OAuth provider).
- Complete one-time admin bootstrap.
- Browse servers/channels and exchange persisted messages.
