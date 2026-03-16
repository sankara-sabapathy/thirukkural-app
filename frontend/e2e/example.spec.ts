import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Thirukkural/);
});

test('adhigaram page loads and links to 10 kurals', async ({ page }) => {
    await page.goto('/adhigaram/1');

    await expect(page.locator('.adhigaram-title')).toContainText('1');
    await expect(page.locator('.adhigaram-kural-card')).toHaveCount(10);
    await expect(page.locator('.breadcrumb-nav')).toContainText('Library');
});

test('kural detail links back to its adhigaram page', async ({ page }) => {
    await page.goto('/adhigaram/1');
    await page.locator('.adhigaram-kural-card').first().click();

    await expect(page).toHaveURL(/\/kural\/1$/);
    await expect(page.locator('.chapter-link-row')).toContainText('Adhigaram 1');
});
