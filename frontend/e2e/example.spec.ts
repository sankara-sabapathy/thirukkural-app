import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Thirukkural/);
});

test('hero section loads', async ({ page }) => {
    await page.goto('/');

    // Expect the hero title to be visible
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.getByText('Start Your Day with')).toBeVisible();
});

test('navigation works', async ({ page }) => {
    await page.goto('/');

    // Click the About link.
    await page.getByRole('link', { name: 'About' }).first().click();

    // Expects page to have a heading with the name of About.
    await expect(page.getByRole('heading', { name: 'About Thirukkural Daily' })).toBeVisible();
});
