import { test, expect, type Page } from '@playwright/test';
import {
  bootstrapSpaceWithChannel,
  loginAndOnboard,
  selectServerByInitial,
  selectChannelByName,
  openDetailsDrawer,
  waitForStatusLive,
} from './helpers';

/**
 * Messaging features: real-time delivery, markdown, edit/delete, reactions,
 * threading. Legacy A4.x steps.
 *
 * We keep these scenarios in a single file (not one-per-feature) because each
 * one needs the same ~5s bootstrap + invite flow; amortizing it dominates.
 */
test.describe('Messaging', () => {
  let pageB: Page;
  let pageBContext: any;

  async function inviteMemberB(page: Page): Promise<string> {
    await openDetailsDrawer(page);
    await page.getByTestId('create-hub-invite-button').click();
    await page.getByTestId('hub-invite-modal').waitFor();
    await page.getByRole('button', { name: 'Generate Invite Link' }).click();
    const inviteUrlInput = page.getByTestId('invite-url-input');
    await expect(inviteUrlInput).toHaveValue(/invite\/[a-zA-Z0-9_-]+/, { timeout: 10000 });
    const url = await inviteUrlInput.inputValue();
    await page.getByTestId('done-invite-modal').click();
    return url;
  }

  async function joinAsMemberB(
    browser: any,
    inviteUrl: string
  ): Promise<{ context: any; page: Page }> {
    const context = await browser.newContext();
    const pb = await context.newPage();
    await pb.goto('/');
    await loginAndOnboard(pb, 'local-member', 'member_b');
    await pb.goto(inviteUrl);
    await expect(pb.locator('.invite-card')).toBeVisible({ timeout: 15000 });
    await Promise.all([
      pb.waitForURL((url: URL) => new URL(url.toString()).pathname === '/', { timeout: 20000 }),
      pb.getByRole('button', { name: 'Accept Invite & Join Hub' }).click(),
    ]);
    await expect(pb.getByTestId('sidebar-container')).toBeVisible({ timeout: 15000 });
    // Wait for the default channel to hydrate so subsequent server nav
    // clicks don't race the chat-client's initial-load useEffect.
    await expect(
      pb.getByTestId('channel-nav-item').filter({ hasText: /#?general/i }).first()
    ).toBeVisible({ timeout: 20000 });
    return { context, page: pb };
  }

  test.beforeEach(async ({ page, browser }) => {
    const { channelName } = await bootstrapSpaceWithChannel(page);
    const inviteUrl = await inviteMemberB(page);

    const joined = await joinAsMemberB(browser, inviteUrl);
    pageBContext = joined.context;
    pageB = joined.page;

    // Both users on the shared Text Lab channel
    await selectServerByInitial(page, 'P');
    await selectChannelByName(page, channelName);
    await waitForStatusLive(page);

    await selectServerByInitial(pageB, 'P');
    await selectChannelByName(pageB, channelName);
    await waitForStatusLive(pageB);
  });

  test.afterEach(async () => {
    await pageBContext?.close();
  });

  test('real-time: Member B message appears live in Admin view', async ({ page }) => {
    const composerB = pageB.locator('textarea[placeholder*="Message"]');
    await expect(composerB).toBeVisible({ timeout: 15000 });
    await pageB.waitForTimeout(500);

    const msg = `Hello from Member B! ${Date.now()}`;
    await composerB.fill(msg);
    await pageB.keyboard.press('Enter');

    await expect(pageB.locator(`text="${msg}"`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text="${msg}"`).first()).toBeVisible({ timeout: 15000 });
  });

  test('markdown: bold + link render in admin view', async ({ page }) => {
    const composer = page.locator('textarea[placeholder*="Message"]');
    const ts = Date.now();
    const md = `**Bold Text** ${ts} and [Skerry Link](https://skerry.io)`;

    await composer.fill(md);
    await composer.press('Enter');

    const msg = page.locator(`[data-testid="message-item"]:has-text("${ts}")`).first();
    await expect(msg).toBeVisible({ timeout: 15000 });
    await expect(msg.locator('.message-content-wrapper strong')).toContainText('Bold Text');
    await expect(msg.locator('a')).toHaveAttribute('href', 'https://skerry.io');
  });

  test('lifecycle: admin can edit and delete their own message', async ({ page }) => {
    const composer = page.locator('textarea[placeholder*="Message"]');
    const original = `Lifecycle test ${Date.now()}`;
    await composer.fill(original);
    await composer.press('Enter');

    const message = page.locator(`[data-testid="message-item"]:has-text("${original}")`).first();
    await expect(message).toBeVisible();

    await message.click({ button: 'right' });
    await expect(page.locator('.context-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Edit Message' }).click();

    const editArea = page.locator('.edit-textarea');
    await expect(editArea).toBeVisible({ timeout: 10000 });
    const edited = `Edited Lifecycle ${Date.now()}`;
    await editArea.fill(edited);
    await editArea.press('Enter');

    await expect(page.locator(`text="${edited}"`)).toBeVisible();
    await expect(page.locator(`text="${original}"`)).not.toBeVisible();

    await page.locator(`[data-testid="message-item"]:has-text("${edited}")`).click({ button: 'right' });
    await expect(page.locator('.context-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Delete Message' }).click();

    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Delete' }).click();

    await expect(
      page.locator(`[data-testid="message-item"]:has-text("${edited}")`)
    ).not.toBeVisible({ timeout: 10000 });
  });

  test('social: reactions and threaded replies', async ({ page }) => {
    const composer = page.locator('textarea[placeholder*="Message"]');
    const reactMsg = `React to me ${Date.now()}`;
    await composer.click();
    await composer.pressSequentially(reactMsg, { delay: 10 });
    await page.keyboard.press('Enter');

    const message = page.locator('[data-testid="message-item"]').filter({ hasText: reactMsg }).first();
    await expect(message).toBeVisible({ timeout: 10000 });
    await expect(message).not.toContainText('Sending...', { timeout: 10000 });

    // --- Reaction ---
    await message.hover();
    await message.click({ button: 'right' });
    await expect(page.locator('.context-menu')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Add Reaction' }).click();

    await expect(page.locator('.emoji-picker-container')).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('.emoji-picker-container .epr-emoji-list button').first()
    ).toBeVisible({ timeout: 10000 });

    const emoji = page
      .locator('.emoji-picker-container button')
      .filter({ has: page.locator('img[alt*="smile"], img[alt*="grinn"], img[alt*="face"]') })
      .or(
        page.locator(
          '.emoji-picker-container button[aria-label*="smil"], .emoji-picker-container button[aria-label*="grinn"]'
        )
      )
      .first();
    await expect(emoji).toBeEnabled({ timeout: 5000 });
    await emoji.click();
    await expect(message.locator('[data-testid="reaction-badge"]')).toBeVisible({ timeout: 5000 });

    // --- Threading ---
    await waitForStatusLive(page);
    await message.click({ button: 'right' });
    await expect(page.locator('.context-menu')).toBeVisible();
    await page.getByRole('button', { name: /Reply in Thread/i }).click();

    const threadPanel = page.locator('.thread-panel');
    await expect(threadPanel).toBeVisible({ timeout: 15000 });

    const threadComposer = threadPanel.locator('textarea');
    const threadReply = `Threaded reply ${Date.now()}`;
    await threadComposer.click();
    await threadComposer.pressSequentially(threadReply, { delay: 30 });
    await threadComposer.press('Enter');

    await expect(
      threadPanel.locator('p').filter({ hasText: threadReply }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(message.locator('.thread-trigger-btn')).toContainText(/repl(y|ies)/i, {
      timeout: 10000,
    });
  });
});
