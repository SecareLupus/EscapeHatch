import { test, expect } from '@playwright/test';

test('completes dev login and sends a message', async ({ page }) => {
  await page.goto('/');

  // Enter a static dev username so that it retains hub_admin after bootstrap
  const uniqueUser = 'local-admin';
  await page.fill('input[id="dev-username"]', uniqueUser);
  await page.click('button:has-text("Dev Login")');

  // Wait for the app to load its state (either Sidebar, Onboarding, or Bootstrap)
  await page.locator('.unified-sidebar')
    .or(page.locator('text="Choose Username"'))
    .or(page.locator('text="Initialize Workspace"'))
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });

  // Handle onboarding (first time user login)
  if (await page.locator('text="Choose Username"').isVisible()) {
    await page.fill('input[id="onboarding-username"]', uniqueUser);
    await page.click('button:has-text("Save Username")');
    await page.locator('.unified-sidebar')
      .or(page.locator('text="Initialize Workspace"'))
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  // If the app requires bootstrap (first run ever), fill it in
  if (await page.locator('text="Initialize Workspace"').isVisible()) {
    await page.fill('input[id="hub-name"]', 'Playwright Hub');
    await page.fill('input[id="setup-token"]', 'bootstrap_token'); // matches .env
    await page.click('button:has-text("Bootstrap Admin + Hub")');
  }

  // Wait for the main UI to load and settle in a specific view
  const navLocator = page.locator('button[aria-label="Create Space"]').or(page.locator('.channels'));
  await expect(navLocator).toBeVisible({ timeout: 15000 });

  // If we are in the channels view, go back to servers view to make a space
  const backButton = page.locator('button[title="Back to Servers"]');
  if (await backButton.isVisible()) {
    await backButton.click();
  }

  // Now we should be in the servers view
  await expect(page.locator('button[aria-label="Create Space"]')).toBeVisible({ timeout: 5000 });

  // Let's create a new Space
  const spaceName = `Test Space ${Date.now()}`;
  await page.locator('button[aria-label="Create Space"]').click();
  await page.fill('input[id="space-name-modal"]', spaceName);
  await page.click('button:has-text("Create Space")');

  // Verify we are taken to the new space (channels view)
  await expect(page.locator(`h2.server-title`)).toContainText(spaceName, { timeout: 10000 });

  // Create a new Room
  const roomName = `test-room-${Date.now()}`;
  await page.locator('button[title="Add..."]').click();
  await page.click('text="New Room"');
  await page.fill('input[id="room-name-modal"]', roomName);
  await page.click('button:has-text("Create Room")');

  // Wait for the room to be active
  const messageInput = page.getByPlaceholder(new RegExp(`Message #${roomName}`));
  await expect(messageInput).toBeVisible({ timeout: 10000 });

  const testMessage = `Hello from Playwright - ${Date.now()}`;
  await messageInput.fill(testMessage);
  await messageInput.press('Enter');

  // Verify the message appears in the chat log
  await expect(page.locator(`text="${testMessage}"`)).toBeVisible();
});
