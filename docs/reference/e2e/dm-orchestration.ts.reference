import { test, expect } from '@playwright/test';

/**
 * Helper: log in as local-admin, bootstrap if needed, and ensure a Space + Room exist.
 */
async function setupWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/');

  const username = 'local-admin';
  await page.fill('input[id="dev-username"]', username);
  await page.click('button:has-text("Dev Login")');

  // Handle first-time onboarding or bootstrap if necessary
  await page.locator('.unified-sidebar')
    .or(page.locator('text="Choose Username"'))
    .or(page.locator('text="Initialize Workspace"'))
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });

  if (await page.locator('text="Choose Username"').isVisible()) {
    await page.fill('input[id="onboarding-username"]', username);
    await page.click('button:has-text("Save Username")');
    await page.locator('.unified-sidebar')
      .or(page.locator('text="Initialize Workspace"'))
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  if (await page.locator('text="Initialize Workspace"').isVisible()) {
    await page.fill('input[id="hub-name"]', 'Playwright Hub');
    await page.fill('input[id="setup-token"]', 'bootstrap_token');
    await page.click('button:has-text("Bootstrap Admin + Hub")');
  }

  // Ensure we are in the servers view
  const backButton = page.locator('button[title="Back to Servers"]');
  if (await backButton.isVisible()) {
    await backButton.click();
  }
}

test('DM orchestration remembers last active DM and last active Room per Space', async ({ page }) => {
  await setupWorkspace(page);

  // 1. Create a Space and a Room
  const spaceName = `Space-${Date.now()}`;
  await page.locator('button[aria-label="Create Space"]').click();
  await page.fill('input[id="space-name-modal"]', spaceName);
  await page.click('button:has-text("Create Space")');
  
  const roomName = `room-${Date.now()}`;
  await page.locator('button[title="Add..."]').click();
  await page.click('text="New Room"');
  await page.fill('input[id="room-name-modal"]', roomName);
  await page.click('button:has-text("Create Room")');

  // Verify room is active
  await expect(page.getByPlaceholder(new RegExp(`Message #${roomName}`))).toBeVisible();

  // 2. Switch to DM list and create a DM
  const backButton = page.locator('button[title="Back to Servers"]');
  await backButton.click();
  
  // Find "New Message" button in DM section
  await page.locator('button[aria-label="New Message"]').click();
  await page.fill('input.search-input', 'bot'); // Search for a bot or user
  // Wait for results
  const firstResult = page.locator('.user-result-item').first();
  await firstResult.waitFor({ state: 'visible' });
  const userName = await firstResult.locator('.display-name').textContent();
  await firstResult.click();

  // Verify DM is active
  await expect(page.getByPlaceholder(new RegExp(`Message ${userName}`))).toBeVisible();

  // 3. Switch back to the Space
  await backButton.click();
  await page.locator(`button:has-text("${spaceName}")`).click();

  // Verify it restored the Room
  await expect(page.getByPlaceholder(new RegExp(`Message #${roomName}`))).toBeVisible();

  // 4. Switch back to DMs (click on any DM in the list)
  await backButton.click();
  await page.locator(`button:has-text("${userName}")`).click();

  // Verify it restored the DM
  await expect(page.getByPlaceholder(new RegExp(`Message ${userName}`))).toBeVisible();
});
