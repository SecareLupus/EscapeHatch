# Sprint Priorities: Discord-Like UX and Functionality

## Goal
Ship a usable, real-time, role-aware chat experience that aligns with core Discord interaction patterns.

## P0 (Must Ship)
1. Realtime message delivery (SSE/WebSocket) with polling fallback.
2. Message list and composer UX: grouped messages, stable scrolling, optimistic send/retry, multiline input.
3. Navigation parity foundation: persistent server/channel rails and contextual channel header.
4. Role-aware controls and clear permission/error feedback.
5. First-run bootstrap wizard fully in UI (no manual curl for happy path).

## P1 (High Value)
1. Channel management UI: create/configure channels, lock, slow mode.
2. Design system pass: shared tokens and component primitives, responsive shell improvements.
3. Accessibility pass: keyboard navigation, focus management, ARIA labels and landmarks.

## P2 (Stretch)
1. Discovery enhancements: channel search/filter and unread placeholders.
2. Hardening: integration coverage for auth/bootstrap/chat/permissions plus traceable error reporting.

## Implementation Order
1. Realtime transport.
2. Message and composer UX improvements.
3. Navigation shell refinement.
4. Bootstrap and role-aware UI behavior.
5. Channel management.
6. Accessibility and visual polish.
7. Testing and observability hardening.
