# Creator Co‑Op Hub Chat Platform

## 1. Purpose
Build a Discord‑like community platform on Matrix for “creator co‑ops”:
- **3–10 creators per hub** (shared infrastructure and governance).
- **Hundreds of members per creator**.
- **Low concurrency** (often 5–10 actively chatting; small group voice).
- **Discord semantics**: Servers, Channels, Roles/Moderators.
- **Hosted web client** with **SSO/OIDC**.
- **Voice chat** (video optional) via **SFU per hub**.
- **Discord bridging**.
- **Preferably not built atop Element** (custom client UX).
- **Limited federation**: hubs may federate only with other hubs in the same managed network.

## 2. Glossary
- **Hub**: A co‑op deployment operated by a group of creators. One homeserver + supporting services.
- **Server (Discord)**: A creator’s semi‑private community area.
- **Channel (Discord)**: A text or voice/video room.
- **Space (Matrix)**: Container used to model a Server; may contain subspaces.
- **Room (Matrix)**: Used to model Channels.
- **Control Plane**: Your product backend that provisions Servers/Channels, enforces policy, and provides admin UI.
- **SFU**: Selective Forwarding Unit (WebRTC media router) for group voice/video.

## 3. Non‑Goals (initial)
- Individual creators running their own homeservers.
- A single shared regional SFU pool across hubs (future option).
- Full open Matrix federation with arbitrary servers.
- Full parity with Discord’s entire feature set on day one.

## 4. Key Requirements
### 4.1 Federation
- Each hub is a Matrix homeserver.
- Federation, if enabled, must be **restricted to other hubs** in the managed network.
- Rooms created by the system should default to **restricted participation** (server ACLs/policies).

### 4.2 Discord‑like Information Model
- **Servers**: One per creator (plus optional shared hub spaces).
- **Channels**: Text + Voice/Video channels.
- **Categories**: Optional subspaces.
- **Roles/Permissions**: Creator admins/mods should control their server and channels without gaining global hub admin.

### 4.3 Voice/Video
- Group voice per channel.
- Video optional.
- Per‑hub SFU deployment.
- TURN available for NAT traversal.

### 4.4 Moderation & Safety
- Creator‑scoped moderation tools (ban/kick/mute/timeout, invite control, slow mode, channel lock).
- Hub‑level operators can respond to abuse across the hub.
- Auditable actions and a reports queue.

### 4.5 Discord Bridging
- Bridge between Discord guild channels and Matrix rooms.
- Admin UX to connect and configure mappings.

### 4.6 Hosted Web Client
- Discord‑like UI (Server rail, Channel rail, main timeline, voice panel).
- SSO/OIDC registration/login.
- Accessible, fast, low overhead.
- Not built atop Element UI.

## 5. High‑Level Architecture
Each hub runs the following components:

### 5.1 Core Services
1) **Matrix Homeserver** (recommended: Synapse)
- Client‑server API, room state, membership, E2EE support (optional in MVP), admin APIs.

2) **Database**
- PostgreSQL for homeserver state.

3) **Media Storage**
- Local disk (MVP) with retention policy.
- Optional: S3/MinIO for scalable storage.

4) **Reverse Proxy / Ingress**
- Nginx/Caddy/Traefik.
- Routes client API and federation.
- Enforces rate limits and request size limits.

5) **Federation Policy Layer**
- Hub allowlist: only federate with domains in the managed hub network.
- Optional federation gateway/proxy for additional enforcement and observability.

### 5.2 Realtime Media
6) **SFU (per hub)**
- LiveKit (recommended), or Janus/Jitsi.
- Provides group voice/video.

7) **TURN (per hub)**
- coturn for NAT traversal.

### 5.3 Product/Control Plane
8) **Provisioning & Policy Service** (Control Plane API)
- Creates creator Servers (Spaces) and Channels (Rooms).
- Applies safe defaults: join rules, room ACLs, power levels, history visibility.
- Maintains mapping of “Discord‑like” entities to Matrix IDs.
- Issues scoped tokens/permissions to web client.

9) **Admin/Moderation Console**
- Creator and hub staff UI.
- Implements scoped moderation actions through the Control Plane.

### 5.4 Integrations
10) **Discord Bridge** (Application Service)
- Bridges configured Discord guild channels to Matrix rooms.

11) **Moderation Bots / Automations**
- Optional: anti‑spam heuristics, reports intake, link filtering, etc.

### 5.5 Identity
12) **OIDC Provider**
- Keycloak (self‑host) or external IdP.
- Synapse configured for OIDC SSO.

## 6. Reference Architecture Diagram (text)

**User Browser**
- Web Client (Next.js/React)
  - Matrix client SDK
  - SFU client SDK

⬇ HTTPS

**Ingress / Reverse Proxy**
- /_matrix/client → Homeserver
- /app → Web client static/app server
- /sfu → SFU

⬇

**Matrix Homeserver (Synapse)** ↔ **PostgreSQL**
- optional workers later if needed

**Homeserver** ↔ **Media Storage**

**Homeserver** ↔ **Control Plane API**
- provisioning, policy, scoped moderation

**Web Client** ↔ **Control Plane API**
- hub/server/channel metadata, role mapping, admin actions

**Web Client** ↔ **SFU**
- voice/video sessions per voice channel

**SFU** ↔ **coturn**

**Discord Bridge** ↔ **Homeserver**
**Discord Bridge** ↔ Discord APIs

## 7. Data Model (Discord semantics on Matrix)

### 7.1 Hub
- Matrix homeserver domain: `hub-<name>.example`
- Optional top “Hub Space” for discovery and shared announcements.

### 7.2 Server (Creator Community)
- Represented as a **Matrix Space**.
- Contains child rooms and subspaces.
- Membership in the Space can gate access to restricted rooms.

### 7.3 Channel
- **Text channel**: Matrix room.
- **Voice channel**: Matrix room with a `voice` type marker and SFU binding.
- **Video channel**: same as voice with video enabled.

Suggested room metadata (state event or room account data managed by Control Plane):
- channel_type: `text | voice | announcement | forum (future)`
- category_id (optional)
- sfu_room_id (for voice/video)

### 7.4 Categories
- Represented as subspaces.

### 7.5 Roles & Permissions
- Matrix power levels + Control Plane role mapping.
- Roles in Control Plane:
  - Hub Operator
  - Creator Admin
  - Creator Moderator
  - Member

**Policy**: creators never receive raw homeserver admin; all privileged operations flow through Control Plane with scope checks.

## 8. Key Flows

### 8.1 Login (OIDC)
1) User visits Web Client.
2) Web Client initiates OIDC login.
3) Homeserver validates via OIDC; user is created/JIT provisioned.
4) Control Plane associates OIDC subject → Matrix user ID.

### 8.2 Create Server (Creator Space)
1) Creator requests “Create Server.”
2) Control Plane calls homeserver admin APIs to:
   - create Space
   - create default channels
   - set power levels
   - apply room ACL defaults
3) Control Plane stores mapping.

### 8.3 Create Channel
1) Creator admin uses UI to create channel.
2) Control Plane creates the room and sets:
   - parent space/subspace
   - join rules and history visibility
   - power levels and moderation defaults
   - for voice/video: provisions SFU room + stores `sfu_room_id`

### 8.4 Join Server / Access Restricted Channels
- Membership in Space used as prerequisite.
- Rooms can be restricted to Space members.

### 8.5 Voice Channel Join
1) User enters voice channel (room).
2) Web Client requests a short‑lived SFU token from Control Plane.
3) Web Client connects to SFU, joins `sfu_room_id`.
4) Presence/roster optionally synced into Matrix room state (lightweight events) for UI.

### 8.6 Moderation Action
1) Creator mod selects user → “Timeout 10m.”
2) Web Client calls Control Plane.
3) Control Plane validates scope (same creator server) and executes:
   - power level change, kick/ban, or bot‑enforced mute
4) Action logged to audit log.

### 8.7 Discord Bridge Setup
1) Creator admin initiates “Connect Discord.”
2) OAuth flow authorizes bot.
3) Control Plane configures bridge:
   - choose guild
   - map channels ↔ rooms
4) Bridge begins syncing messages.

## 9. Federation Policy (Managed Network)

### 9.1 Default: Hub‑Only Federation
- Federation allowed only to an allowlisted set of other hubs.
- Apply `m.room.server_acl` (or equivalent policy) by default on system‑created rooms.

### 9.2 Future: Cross‑Hub Shared Spaces
- Optional shared rooms (events, collaboration) between hubs.
- Still restricted to managed hub domains.

## 10. Moderation & Safety Feature Set (MVP)
- User management: kick, ban, unban.
- Timeouts (implemented via bot‑side enforcement or power level/permissions pattern).
- Message redaction and bulk delete (where feasible).
- Channel controls: lock channel, slow mode, link/media restrictions.
- Reports: user report → queue → action + resolution reason.
- Audit log: who did what, when, and in which server/channel.

## 11. Technology Choices (Recommended)
- Homeserver: Synapse
- DB: PostgreSQL
- Proxy: Caddy/Nginx
- SFU: LiveKit
- TURN: coturn
- OIDC: Keycloak (or external)
- Control Plane + Admin UI: Node/TypeScript (or Go) + Postgres
- Web Client: Next.js/React + Matrix JS SDK + SFU SDK
- Discord Bridge: matrix‑appservice‑discord or mautrix‑discord (evaluate fit)

## 12. Deployment & Ops

### 12.1 Packaging
- Docker Compose for MVP.
- Kubernetes optional for multi‑hub operations.

### 12.2 Observability
- Metrics: Prometheus + Grafana.
- Logs: Loki/ELK.
- Error tracking: Sentry.

### 12.3 Backups
- Postgres nightly backups.
- Media backups (or retention + object storage).

### 12.4 Retention & Compliance
- Media retention policy configurable per hub.
- Optional: message retention per room type.

## 13. MVP Milestones

### Milestone 0 — Hub Bootstrap
- Synapse + Postgres + OIDC login working.
- Web client skeleton: login, basic room list, send/receive messages.

### Milestone 1 — Discord Semantics
- Control Plane creates creator Servers (Spaces).
- Channel creation UI (text channels).
- Role mapping for creator admins/mods.

### Milestone 2 — Moderation Basics
- Scoped moderation actions.
- Reports queue + audit log.
- Channel lock/slow mode.

### Milestone 3 — Voice (per hub SFU)
- Voice channels as rooms.
- Token issuance and SFU join.
- Basic roster and UI controls.

### Milestone 4 — Discord Bridge
- Connect Discord wizard.
- Channel mappings.
- Basic formatting and media relay.

### Milestone 5 — Video (optional)
- Enable video tracks in SFU.
- Bandwidth/quality controls.

## 14. Risks & Mitigations
- **Matrix state complexity**: keep Discord semantics primarily in Control Plane; write minimal state events.
- **Scoped admin**: do not expose homeserver admin; use Control Plane as policy gate.
- **Bridging edge cases**: start with limited formatting; document limitations.
- **Voice UX**: treat SFU as authoritative; only mirror presence lightly to Matrix.

## 15. Future Options
- Shared regional SFU pool (Option B) for operators managing multiple hubs.
- Synapse workers split if a hub grows.
- Advanced roles, monetization roles, entitlement‑based room access.
- Cross‑hub discovery and shared events rooms.

