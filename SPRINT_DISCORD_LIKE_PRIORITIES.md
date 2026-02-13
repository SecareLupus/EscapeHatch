# Sprint Priorities: Discord-Like UX and Functionality

## Goal
Ship a usable, real-time, role-aware chat experience that aligns with core Discord interaction patterns.

## Sprint Status
- **Status:** `P0 complete`, `P1 mostly complete`, `P2 partially complete`.
- **Focus completed this pass:** room scoping stability, manager targeting UX, keyboard navigation, and modal focus management.

## P0 (Must Ship)
- [x] Realtime message delivery (SSE) with polling fallback.
- [x] Message list/composer UX: grouped messages, stable scrolling, optimistic send + retry, multiline input.
- [x] Navigation foundation: persistent server/channel rails and contextual channel header.
- [x] Role-aware controls with permission feedback.
- [x] First-run bootstrap wizard fully in UI (no manual curl on happy path).

## P1 (High Value)
- [x] Channel management UI: create/rename/delete channels, create/rename categories, move channels to category, lock + slow mode controls.
- [x] Design system pass (MVP): shared visual tokens, responsive shell, unified panel/button/form patterns.
- [x] Accessibility pass (MVP): ARIA landmarks/labels, keyboard navigation for server/channel rails, focus-visible states, modal Escape + focus trap.

## P2 (Stretch)
- [x] Discovery baseline: channel search/filter and unread badges.
- [~] Hardening: integration coverage for auth/bootstrap/chat/permissions and structured error telemetry.

## Completed Deliverables
1. Real-time chat transport with live status and polling fallback behavior.
2. Discord-like shell with server rail, category-scoped channel rail, timeline, and context pane.
3. Hub/Space/Room manager dialog near account controls with scoped mutation actions.
4. First-login bootstrap flow and role-scoped management checks.
5. Room/category management behaviors mapped to selected space (no shared-room UI bleed).
6. Accessibility improvements for keyboard users and modal interaction.

## Carryover (Next Sprint)
1. Extend integration/API tests from unauthenticated/error-path coverage to full authenticated provisioning and moderation flows.
2. Add persistent request tracing sinks (log aggregation / external telemetry backend) beyond per-response correlation IDs.
3. Improve discovery with unread-by-channel persistence and mention/highlight handling.
