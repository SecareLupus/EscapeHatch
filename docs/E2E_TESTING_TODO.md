# Skerry E2E Testing Roadmap

This document outlines the Master TODO list for the Playwright E2E test suite. The tests are organized into **Execution Sequences** to minimize system resets and maximize state reuse.

---

## 🚀 Execution Sequence A: Community Lifecycle
**Objective:** Test the "Golden Path" for creators and members in a fresh instance.
**Initial State:** `docker compose -f docker-compose-test.yml up -d` (Fresh DB)

### A1. Onboarding & Core UI
- [ ] **A1.1: Administrative Gateway**
  - Use Dev Login (`local-admin`) to gain initial system authority.
  - Complete the "Choose Username" handle onboarding flow (Identity Setup).
  - Complete the "Initialize Workspace" flow (Hub Name + Setup Token).
- [ ] **A1.2: Core UI Verification**
  - Verify the primary hub UI shell (sidebar/topbar) manifests after bootstrap.
  - Verify the default `#general` channel is accessible.
- [ ] **A1.3: User Profile Verification**
  - Open the profile editor and verify nickname/bio database persistence.

### A2. Community Orchestration
- [ ] **A2.1: Creator Server Creation**
  - Admin: Create a new Server (Matrix Space).
  - Verify the new server icon appears in the server rail.
- [ ] **A2.2: Category Orchestration**
  - Create a Category (sub-space) within the new server.
  - Verify the category header renders in the sidebar.
- [ ] **A2.3: Text Channel Orchestration**
  - Create a Text Channel inside a Category.
  - Verify standard message sending/receiving.
- [ ] **A2.4: Voice Channel Orchestration**
  - Create a Voice Channel (LiveKit integration).
  * Verify signaling connection and voice room UI state.

### A3. The Orientation Bridge
- [ ] **A3.1: Invite Generation**
  - Admin: Generate an Invite Link for the new Server.
  - Verify success toast and link format.
- [ ] **A3.2: Invitation Usage**
  - Member B: Access the invite (via separate user context).
  - Verify successful joining of the server.

### A4. Advanced Messaging & Social
- [ ] **A4.1: Real-time Multi-user Chat**
- [ ] **A4.2: Markdown & Rich Text**
- [ ] **A4.3: Message Lifecycle**
- [ ] **A4.4: Social Interactions** (Threads, Reactions, Mentions)

### A5. Permissions & Moderation
- [ ] **A5.1: Permission Gates**
- [ ] **A5.2: Scoped Moderation Actions**
- [ ] **A5.3: Audit Log & Reporting**

---

## 🛠️ Execution Sequence B: Discord Orchestration
**Objective:** Test the Application Service bridge and bidirectional consistency.
**Initial State:** Sequence A completed OR configured bridge mocks active.

### B1. Bridge Lifecycle
- [ ] **B1.1: Guild Connection**
- [ ] **B1.2: Outbound Sync (Skerry -> Discord)**
- [ ] **B1.3: Inbound Sync (Discord -> Skerry)**
- [ ] **B1.4: Formatting Consistency**

---

## 📝 Implementation Notes
- **Test User A:** Admin (Creator).
- **Test User B:** Member (Guest).
- **Resets:** System reset is only mandatory between Sequence groups (e.g., after Sequence A completes, wipe for Sequence B).
