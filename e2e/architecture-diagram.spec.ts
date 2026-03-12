// ABOUTME: E2E smoke tests for the code-vision app.
// ABOUTME: Verifies core pages load without crashing.
import { test, expect } from '@playwright/test';

test.describe('App smoke tests', () => {
  test('login page loads without application errors', async ({ page }) => {
    await page.goto('/login');
    await expect(page).not.toHaveTitle(/error/i);
    const body = page.locator('body');
    await expect(body).not.toContainText('Application error');
    await expect(body).not.toContainText('Internal Server Error');
  });

  test('unauthenticated visit to root redirects or loads without crashing', async ({ page }) => {
    await page.goto('/');
    // Either the projects page or a redirect to /login — either is fine, just no crash
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });
});
