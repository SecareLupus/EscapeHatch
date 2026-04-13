import { test, expect } from '@playwright/test';

/**
 * Sequence A: Community Lifecycle
 * 
 * This test uses nested steps to maintain session state (browser cookies)
 * throughout the entire lifecycle while providing granular reporting.
 */
test('Sequence A: Community Lifecycle', async ({ page }) => {
  
  // -- A1: Onboarding & Core UI --
  
  await test.step('A1.1: Administrative Gateway', async () => {
    await page.goto('/');
    
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
    await page.locator('#setup-token').clear();
    await page.locator('#setup-token').fill('test_bootstrap_token');
    await page.getByRole('button', { name: 'Bootstrap Admin + Hub' }).click();
  });

  await test.step('A1.2: Core UI Verification', async () => {
    // Verify Shell manifested
    await expect(page.locator('.sidebar-drawer-container')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.topbar-id')).toContainText('Signed in as admin');
    
    // Verify default channel accessibility
    const generalChannel = page.locator('.list-item', { hasText: '#general' });
    await expect(generalChannel).toBeVisible({ timeout: 10000 });
    await generalChannel.click();
    await expect(page.locator('.channel-header h2')).toContainText('general');
  });

  await test.step('A1.3: User Profile Verification', async () => {
    // Send a message to create a clickable author name
    const composer = page.locator('textarea[placeholder*="Message"]');
    await composer.fill('Profile verification sequence initiated.');
    await page.keyboard.press('Enter');
    
    // Wait for the message to appear
    const messageItem = page.locator('[data-testid="message-item"]').first();
    await expect(messageItem).toBeVisible({ timeout: 10000 });
    
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
    const addBtn = page.locator('nav.channels button[title="Add..."]');
    await addBtn.click();
    
    await page.locator('.add-menu-dropdown').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'New Room' }).click();
    
    await page.locator('#room-name-modal').clear();
    await page.locator('#room-name-modal').fill('Voice Lab');
    await page.locator('#room-type-modal').selectOption('voice');
    await page.getByRole('button', { name: 'Create Room' }).click();
    
    await expect(page.locator('.modal-backdrop')).not.toBeVisible();
    
    const roomBtn = page.locator('.list-item', { hasText: /Voice Lab/i });
    await expect(roomBtn).toBeVisible({ timeout: 15000 });
    await roomBtn.click();
    
    // Stabilized Join Logic: scope to sidebar and verify state transition
    const detailsSidebar = page.locator('aside', { hasText: /Channel Details/i });
    await expect(detailsSidebar.getByText(/Voice Controls/i)).toBeVisible({ timeout: 10000 });
    
    const joinBtn = detailsSidebar.getByRole('button', { name: 'Join Voice' });
    await expect(joinBtn).toBeVisible({ timeout: 10000 });
    await joinBtn.click();
    
    // Explicit wait for Reactive state transition in Sidebar
    await expect(detailsSidebar.getByText(/Status: Connected/i)).toBeVisible({ timeout: 15000 });
    
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
    
    await page.getByRole('button', { name: 'Copy' }).click();
    // Corrected filter based on strict mode violation
    await expect(page.locator('.toast-success').filter({ hasText: 'Link copied!' }).last()).toBeVisible({ timeout: 5000 });
    
    await page.keyboard.press('Escape');
  });

});
