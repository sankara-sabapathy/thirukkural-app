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
    await expect(page.locator('.faq-item')).toHaveCount(4);
    await page.locator('.faq-item').first().click();
    await expect(page.locator('.faq-item').first()).toContainText('What is Adhigaram 1 in Thirukkural?');
});

test('kural detail links back to its adhigaram page', async ({ page }) => {
    await page.goto('/adhigaram/1');
    await page.locator('.adhigaram-kural-card').first().click();

    await expect(page).toHaveURL(/\/kural\/1$/);
    await expect(page.locator('.chapter-link-row')).toContainText('Adhigaram 1');
});

test('library can switch to adhigaram scope and preserve state after back navigation', async ({ page }) => {
    await page.goto('/kurals');

    await page.locator('.scope-toggle-adhigaram').click();
    await page.locator('.hero-search-input').fill('108');

    const adhigaramCard = page.locator('.adhigaram-item').first();
    await expect(adhigaramCard).toContainText('108');

    await adhigaramCard.click();
    await expect(page).toHaveURL(/\/adhigaram\/108$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/kurals\?view=adhigaram&q=108$/);
    await expect(page.locator('.scope-toggle-adhigaram')).toHaveClass(/mat-button-toggle-checked/);
    await expect(page.locator('.hero-search-input')).toHaveValue('108');
});
