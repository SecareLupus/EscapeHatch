# Shared Contracts Architecture

## Ownership boundary
- Home of cross-app domain contracts and auth/session DTOs.
- Any entity exchanged across `apps/web` and `apps/control-plane` belongs here.

## Extension points
- `src/domain`: hub/server/category/channel contracts and provisioning payloads.
- `src/auth`: identity mapping/session/account-linking contracts.

## Milestone alignment
- Supports Milestone 0 identity mapping evolution without schema rewrites.
- Supports Milestone 1 provisioning APIs with stable typed contracts.
