import { test, expect } from '@playwright/test';

/**
 * Sequence A: Community Lifecycle
 * 
 * This test uses nested steps to maintain session state (browser cookies)
 * throughout the entire lifecycle while providing granular reporting.
 */
test('Sequence A: Community Lifecycle', async ({ page, browser }) => {
  // Increase timeout for the full lifecycle sequence
  test.setTimeout(120000);

  let inviteUrl = '';
  // Shared Member B context to preserve state across steps
  let contextB: any = null;
  let pageB: any = null;
  
  // -- A1: Onboarding & Core UI --
  
  await test.step('A1.1: Administrative Gateway', async () => {
    await page.goto('/');

    // Check for idempotency: if already logged in/bootstrapped, trigger a soft reset via API
    // This allows re-running the test against a persistent container without manually deleting volumes.
    if (await page.locator('.sidebar-drawer-container').isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Detected existing session, triggering test-reset...');
      await page.request.post('/v1/system/test-reset');
      await page.goto('/');
    }
    
    // 1. Login (Must happen first for any session)
    await expect(page.locator('.login-container')).toBeVisible({ timeout: 15000 });
    await page.locator('#dev-username').clear();
    await page.locator('#dev-username').fill('local-admin');
    await page.getByRole('button', { name: 'Dev Login' }).click();

    // 2. Identity Setup (Onboarding blocks everything else)
    await expect(page.getByText('Choose Username')).toBeVisible({ timeout: 15000 });
    await page.locator('#onboarding-username').clear();
    await page.locator('#onboarding-username').fill('admin');
    await page.getByRole('button', { name: 'Save Username' }).click();

    // 3. Workspace Initialization (Bootstrap happens for first admin after onboarding)
    await expect(page.getByText('Initialize Workspace')).toBeVisible({ timeout: 15000 });
    await page.locator('#hub-name').clear();
    await page.locator('#hub-name').fill('Skerry E2E Test Hub');
    await page.locator('#setup-token').fill('test_bootstrap_token');
    
    await Promise.all([
        page.waitForURL((url) => url.pathname === '/', { timeout: 30000 }),
        page.getByRole('button', { name: 'Bootstrap Admin + Hub' }).click()
    ]);
  });

  await test.step('A1.2: Core UI Verification', async () => {
    // Verify Shell manifested using stable ID
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.topbar-id')).toContainText('Signed in as admin');
    
    // Verify default channel accessibility using the new stable ID
    const generalChannel = page.getByTestId('channel-nav-item').filter({ hasText: '#general' });
    await expect(generalChannel).toBeVisible({ timeout: 15000 });
    await generalChannel.click();
    await expect(page.locator('.channel-header h2')).toContainText('general', { timeout: 10000 });
  });

  await test.step('A1.3: User Profile Verification', async () => {
    // Ensure we are in a text channel and the sidebar is reactive
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 15000 });
    
    // Send a message to create a clickable author name
    const composer = page.locator('textarea[placeholder*="Message"]');
    await expect(composer).toBeEnabled({ timeout: 10000 });
    
    // Using type() instead of fill() to better simulate user intent and handle React state sync
    await composer.click();
    await page.keyboard.type('Profile verification sequence initiated.');
    
    // Explicitly wait for the Send button to be enabled to confirm React state sync
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeEnabled({ timeout: 10000 });
    await sendBtn.click();
    
    // Wait for the message to appear in the timeline
    const messageItem = page.locator('[data-testid="message-item"]').first();
    await expect(messageItem).toBeVisible({ timeout: 15000 });
    
    // Click our own author name
    const authorName = messageItem.locator('.author-name');
    await authorName.click();
    
    // Verify & Edit Profile Modal
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.username')).toContainText('@admin');
    
    await modal.getByRole('button', { name: 'Edit Profile' }).click();
    await modal.locator('input[placeholder="How should people see you?"]').clear();
    await modal.locator('input[placeholder="How should people see you?"]').fill('Skerry Admin');
    await modal.locator('textarea[placeholder="Tell us about yourself"]').clear();
    await modal.locator('textarea[placeholder="Tell us about yourself"]').fill('Automated Test bio for Sequence A.');
    await modal.getByRole('button', { name: 'Save Changes' }).click();
    
    // Verify persistence
    await expect(modal.locator('h1')).toContainText('Skerry Admin');
    await expect(modal.locator('.bio-text')).toContainText('Automated Test bio for Sequence A.');
    
    await modal.locator('.close-button').click();
    await expect(modal).not.toBeVisible();
  });

  // -- A2: Community Orchestration --

  await test.step('A2.1: Creator Server Creation', async () => {
    // If we are in the Channels view, navigate back to the Servers rail
    // The button has title="Back to Servers" but often shows up as "←" in some accessibility trees
    const backButton = page.locator('.back-button');
    if (await backButton.isVisible()) {
        await backButton.click();
    }
    
    // Explicitly wait for the Servers rail to be the active view
    await expect(page.getByRole('heading', { name: 'Servers', level: 2 })).toBeVisible({ timeout: 15000 });
    
    const createSpaceBtn = page.getByRole('button', { name: 'Create Space' });
    await expect(createSpaceBtn).toBeVisible({ timeout: 15000 });
    await createSpaceBtn.click();
    
    const modal = page.locator('.modal-backdrop:has(.modal-panel)');
    await expect(modal).toBeVisible();
    await modal.locator('#space-name-modal').clear();
    await modal.locator('#space-name-modal').fill('Playwright Server');
    await modal.getByRole('button', { name: 'Create Space' }).click();
    
    await expect(page.locator('.server-title')).toContainText('Playwright Server', { timeout: 15000 });
  });

  await test.step('A2.2: Category Orchestration', async () => {
    const addBtn = page.locator('nav.channels button[title="Add..."]');
    await addBtn.click();
    
    // Ensure dropdown is visible
    await page.locator('.add-menu-dropdown').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'New Category' }).click();
    
    await page.locator('#category-name-modal').clear();
    await page.locator('#category-name-modal').fill('Test Category');
    await page.getByRole('button', { name: 'Create Category' }).click();
    
    await expect(page.locator('.category-heading', { hasText: 'Test Category' })).toBeVisible({ timeout: 15000 });
  });

  await test.step('A2.3: Text Channel Orchestration', async () => {
    const addBtn = page.locator('nav.channels button[title="Add..."]');
    await addBtn.click();
    
    await page.locator('.add-menu-dropdown').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'New Room' }).click();
    
    await page.locator('#room-name-modal').clear();
    await page.locator('#room-name-modal').fill('Text Lab');
    await page.getByRole('button', { name: 'Create Room' }).click();
    
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 15000 });
    
    const roomBtn = page.locator('.list-item', { hasText: /#Text Lab/i });
    await expect(roomBtn).toBeVisible({ timeout: 15000 });
    await roomBtn.click();
    
    const chatHeader = page.locator('.channel-header h2');
    await expect(chatHeader).toContainText(/Text Lab/i, { timeout: 15000 });
  });

  await test.step('A2.4: Voice Channel Orchestration', async () => {
    const addBtn = page.getByTestId('add-channel-menu-trigger');
    await addBtn.click();
    
    await page.getByTestId('add-menu-dropdown').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'New Room' }).click();
    
    await page.locator('#room-name-modal').clear();
    await page.locator('#room-name-modal').fill('Voice Lab');
    await page.locator('#room-type-modal').selectOption('voice');
    await page.getByRole('button', { name: 'Create Room' }).click();
    
    await expect(page.getByTestId('modal-backdrop')).not.toBeVisible();
    
    const roomBtn = page.getByTestId('channel-nav-item').filter({ hasText: /Voice Lab/i });
    await expect(roomBtn).toBeVisible({ timeout: 15000 });
    await roomBtn.click();
    await expect(page.locator('.channel-header h2')).toContainText(/Voice Lab/i, { timeout: 15000 });
    
    // Debug: Ensure React state is synced
    const debugMarker = page.getByTestId('debug-voice-state');
    await expect(debugMarker).toHaveAttribute('data-type', 'voice', { timeout: 10000 });
    await expect(debugMarker).toHaveAttribute('data-voice-connected', 'false', { timeout: 10000 });

    const joinBtn = page.getByTestId('join-voice-btn');
    await expect(joinBtn).toBeVisible({ timeout: 10000 });
    await joinBtn.click();
    
    const detailsSidebar = page.locator('aside', { hasText: /Channel Details/i });
    
    // Explicit wait for Reactive state transition using the debug marker
    await expect(debugMarker).toHaveAttribute('data-voice-connected', 'true', { timeout: 15000 });
    
    // Verify Sidebar state
    await expect(detailsSidebar.getByText(/Status: Connected/i)).toBeVisible({ timeout: 10000 });
    
    // RTC connection verification
    await expect(page.locator('.voice-room')).toBeVisible({ timeout: 20000 });
    
    // Verify admin identity in the room
    const adminCard = page.locator('.voice-room .participant-card', { hasText: /admin/i });
    await expect(adminCard).toBeVisible({ timeout: 20000 });
    
    const leaveBtn = page.getByRole('button', { name: 'Leave Voice' });
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();
    
    await expect(page.locator('.voice-room')).not.toBeVisible();
    await expect(detailsSidebar.getByText(/Status: Disconnected/i)).toBeVisible();
  });

  // -- A3: The Orientation Bridge --

  await test.step('A3.1: Invite Generation', async () => {
    const detailsBtn = page.locator('button[title*="Toggle Details"]');
    const detailsPanel = page.locator('.details-drawer-container');
    
    if (!await detailsPanel.isVisible()) {
        await detailsBtn.click();
        await expect(detailsPanel).toBeVisible({ timeout: 5000 });
    }

    const inviteBtn = page.locator('button[title="Create Hub Invite"]');
    await expect(inviteBtn).toBeVisible({ timeout: 10000 });
    await inviteBtn.click();
    
    await expect(page.getByText(/Invite to/i)).toBeVisible();
    const generateBtn = page.getByRole('button', { name: 'Generate Invite Link' });
    await generateBtn.click();
    
    const inviteUrlInput = page.locator('input[readOnly]');
    await expect(inviteUrlInput).toHaveValue(/invite\/[a-zA-Z0-9_-]+/);
    inviteUrl = await inviteUrlInput.inputValue();
    
    await page.getByRole('button', { name: 'Copy' }).click();
    // Corrected filter based on strict mode violation
    await expect(page.locator('.toast-success').filter({ hasText: 'Link copied!' }).last()).toBeVisible({ timeout: 5000 });
    
    // Close modal explicitly to prevent blocking A4.1
    // Use a more specific locator for the modal close button
    const closeModalBtn = page.locator('button').filter({ hasText: /^×$/ }).first();
    if (await closeModalBtn.isVisible()) {
        await closeModalBtn.click({ force: true });
    } else {
        await page.keyboard.press('Escape');
    }
    await expect(page.getByText(/Invite to/i)).not.toBeVisible({ timeout: 8000 });
  });

  await test.step('A3.2: Invitation Usage', async () => {
    // 1. Setup Member B context (Create fresh if not already exists)
    if (!contextB) {
        contextB = await browser.newContext();
        pageB = await contextB.newPage();
    }
    
    try {
        await pageB.goto('/');
        
        // 1. Login as Member B
        await expect(pageB.locator('.login-container')).toBeVisible({ timeout: 15000 });
        await pageB.locator('#dev-username').clear();
        await pageB.locator('#dev-username').fill('local-member');
        await pageB.getByRole('button', { name: 'Dev Login' }).click();

        // 2. Identity Setup for Member B
        await expect(pageB.getByText('Choose Username')).toBeVisible({ timeout: 15000 });
        await pageB.locator('#onboarding-username').clear();
        await pageB.locator('#onboarding-username').fill('member_b');
        await pageB.getByRole('button', { name: 'Save Username' }).click();

        // 3. Navigate to Invitation and Join
        console.log(`[A3.2] Navigating Member B to: ${inviteUrl}`);
        await pageB.goto(inviteUrl);
        await expect(pageB.locator('.invite-card')).toBeVisible({ timeout: 15000 });
        
        // Accept and wait for redirect to Home
        console.log('[A3.2] Clicking Accept Invite...');
        await Promise.all([
            pageB.waitForURL((url) => url.pathname === '/', { timeout: 20000 }),
            pageB.getByRole('button', { name: 'Accept Invite & Join Hub' }).click()
        ]);

        console.log('[A3.2] Redirected to:', pageB.url());
        if (pageB.url().includes('/login')) {
            throw new Error('[A3.2] Redirected to /login unexpectedly. Session lost?');
        }

        // 4. Verify landing (Home Hub)
        console.log('[A3.2] Waiting for sidebar container...');
        await expect(pageB.getByTestId('sidebar-container')).toBeVisible({ timeout: 15000 });
        
        // Home Hub should have #general
        console.log('[A3.2] Verifying #general in Home Hub...');
        await expect(pageB.getByTestId('channel-nav-item').filter({ hasText: /#?general/i })).toBeVisible({ timeout: 20000 });

        // 5. Switch to Playwright Server and verify #Text Lab
        console.log('[A3.2] Navigating to Playwright Server...');
        
        // Ensure we are in the Servers view so we can see the server-nav-items
        const backBtn = pageB.getByTestId('back-to-servers');
        if (await backBtn.isVisible()) {
            await backBtn.click();
        }
        
        // Now we should see the server icons
        console.log('[A3.2] Waiting for server list synchronization...');
        await expect(pageB.getByTestId('server-nav-item')).toHaveCount(2, { timeout: 25000 });

        const serverTitle = pageB.locator('.server-title');
        let playwrightIcon = pageB.getByTestId('server-nav-item').filter({ hasText: 'P' });
        
        if (!(await playwrightIcon.isVisible())) {
            console.log('[A3.2] Playwright Server icon not found. Reloading...');
            await pageB.reload();
            await expect(pageB.getByTestId('sidebar-container')).toBeVisible({ timeout: 15000 });
            
            // Re-nav back to servers after reload if necessary
            if (await backBtn.isVisible()) {
                await backBtn.click();
            }
            playwrightIcon = pageB.getByTestId('server-nav-item').filter({ hasText: 'P' });
        }
        
        await playwrightIcon.click({ force: true });
        
        // Verify Playwright Server title
        await expect(serverTitle).toHaveText('Playwright Server', { timeout: 15000 });
        
        // Verify #Text Lab channel is visible
        console.log('[A3.2] Verifying #Text Lab in Playwright Server...');
        await expect(pageB.getByTestId('channel-nav-item').filter({ hasText: /#?Text Lab/i })).toBeVisible({ timeout: 15000 });
        
    } catch (err) {
        console.error('A3.2 FAILURE FORENSICS (Member B):');
        const url = pageB.url();
        const content = await pageB.content();
        console.error(`URL: ${url}`);
        console.error(`CONTENT: ${content.slice(0, 3000)}`);
        throw err;
    }
  });


  // -- A4: Advanced Messaging & Social --

  await test.step('A4.1: Real-time Multi-user Chat', async () => {
    // 1. Ensure Admin is on Playwright Server / #Text Lab
    console.log('[A4.1] Navigating Admin to #Text Lab...');
    
    // Close any stray modals first
    const strayModalClose = page.getByRole('button', { name: '×' }).first();
    if (await strayModalClose.isVisible()) {
        await strayModalClose.click();
    }

    // Ensure we are in the Servers view so we can see the server-nav-items
    const adminBack = page.getByTestId('back-to-servers');
    if (await adminBack.isVisible()) await adminBack.click();
    
    // Explicitly wait for server icons to be visible
    await expect(page.getByTestId('server-nav-item')).not.toHaveCount(0, { timeout: 15000 });
    await page.getByTestId('server-nav-item').filter({ hasText: 'P' }).click();
    await page.getByTestId('channel-nav-item').filter({ hasText: /#?Text Lab/i }).click();

    // 2. Ensure Member B is ready (Re-use existing context from A3.2)
    if (!contextB || !pageB) {
        contextB = await browser.newContext();
        pageB = await contextB.newPage();
        await pageB.goto('/');
        await pageB.locator('#dev-username').fill('local-member');
        await pageB.getByRole('button', { name: 'Dev Login' }).click();
        await expect(pageB.getByTestId('sidebar-container')).toBeVisible({ timeout: 15000 });
    }
    
    // 3. Navigate Member B to Playwright Server / #Text Lab
    console.log('[A4.1] Navigating Member B to #Text Lab...');
    
    // We expect Member B to already be on some page. 
    // Ensure we are in a clean state for the server switch.
    const backBtn = pageB.getByTestId('back-to-servers');
    if (await backBtn.isVisible()) await backBtn.click();
    
    // Select Playwright Server
    await expect(pageB.getByTestId('server-nav-item')).not.toHaveCount(0, { timeout: 15000 });
    await pageB.getByTestId('server-nav-item').filter({ hasText: 'P' }).click();
    
    const channelBtn = pageB.getByTestId('channel-nav-item').filter({ hasText: /#?Text Lab/i });
    await expect(channelBtn).toBeVisible({ timeout: 15000 });
    await channelBtn.click();
    
    // 4. Member B sends a message
    const composerB = pageB.locator('textarea[placeholder*="Message"]');
    await expect(composerB).toBeVisible({ timeout: 15000 });
    const msgContent = `Hello from Member B! ${Date.now()}`;
    await composerB.fill(msgContent);
    
    const sendBtnB = pageB.locator('button').filter({ hasText: /^Send$/ });
    await expect(sendBtnB).toBeEnabled({ timeout: 10000 });
    await sendBtnB.click();
    
    // 5. Verify synchronization
    console.log('[A4.1] Verifying message delivery...');
    // Member B sees their own message
    try {
        await expect(pageB.locator(`text="${msgContent}"`)).toBeVisible({ timeout: 10000 });
    } catch (err) {
        console.error('A4.1 FAILURE FORENSICS (Member B):');
        console.error(`URL: ${pageB.url()}`);
        console.error(`CONTENT: ${(await pageB.content()).slice(0, 3000)}`);
        throw err;
    }
    
    // Admin (original page) should see the message arrive in real-time
    await expect(page.locator(`text="${msgContent}"`)).toBeVisible({ timeout: 15000 });
  });

  await test.step('A4.2: Markdown & Rich Text', async () => {
    // Ensure Admin is on Playwright Server
    if (await page.locator('.server-title').textContent() !== 'Playwright Server') {
        const adminBack = page.getByTestId('back-to-servers');
        if (await adminBack.isVisible()) await adminBack.click();
        await page.getByTestId('server-nav-item').filter({ hasText: 'P' }).click();
    }
    
    const composer = page.locator('textarea[placeholder*="Message"]');
    const markdownMsg = '**Bold Text** and [Skerry Link](https://skerry.io)';
    await composer.fill(markdownMsg);
    await composer.press('Enter');
    
    const lastMsg = page.locator('[data-testid="message-item"]').first();
    await expect(lastMsg.locator('strong')).toContainText('Bold Text');
    await expect(lastMsg.locator('a')).toHaveAttribute('href', 'https://skerry.io');
  });

  await test.step('A4.3: Message Lifecycle (Edit/Delete)', async () => {
    const originalContent = `Lifecycle test ${Date.now()}`;
    const composer = page.locator('textarea[placeholder*="Message"]');
    await composer.fill(originalContent);
    await composer.press('Enter');
    
    const message = page.locator(`[data-testid="message-item"]:has-text("${originalContent}")`).first();
    await expect(message).toBeVisible();
    
    // Edit
    await message.click({ button: 'right' });
    await page.getByRole('button', { name: 'Edit Message' }).click();
    
    const editArea = page.locator('.edit-textarea');
    const editedContent = `Edited Lifecycle ${Date.now()}`;
    await editArea.fill(editedContent);
    await editArea.press('Enter');
    
    await expect(page.locator(`text="${editedContent}"`)).toBeVisible();
    await expect(page.locator(`text="${originalContent}"`)).not.toBeVisible();
    
    // Delete
    page.on('dialog', d => d.accept());
    await page.locator(`text="${editedContent}"`).click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete Message' }).click();
    
    await expect(page.locator(`text="${editedContent}"`)).not.toBeVisible({ timeout: 10000 });
  });

  await test.step('A4.4: Social Interactions', async () => {
    // Reaction
    const composer = page.locator('textarea[placeholder*="Message"]');
    await composer.fill('React to me');
    await composer.press('Enter');
    
    const message = page.locator('[data-testid="message-item"]').first();
    await message.click({ button: 'right' });
    await page.getByRole('button', { name: 'Add Reaction' }).click();
    
    // Pick an emoji (assuming 👍 is available)
    const emoji = page.locator('button', { hasText: '👍' }).first();
    await emoji.click();
    
    await expect(page.locator('[data-testid="reaction-badge"]')).toBeVisible({ timeout: 5000 });
    
    // Threading
    await message.click({ button: 'right' });
    await page.getByRole('button', { name: 'Reply in Thread' }).or(page.locator('button:has-text("Reply")')).click();
    
    const threadPanel = page.locator('.thread-panel');
    await expect(threadPanel).toBeVisible({ timeout: 10000 });
    
    const threadComposer = threadPanel.locator('textarea');
    await threadComposer.fill('This is a threaded reply');
    await threadComposer.press('Enter');
    
    await expect(threadPanel.locator('text="This is a threaded reply"')).toBeVisible();
});

  // Final cleanup for Member B
  if (contextB) {
    await contextB.close();
  }
});
