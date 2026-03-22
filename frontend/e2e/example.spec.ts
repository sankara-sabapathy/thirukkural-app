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
    await expect(page.locator('.breadcrumb-nav')).toContainText('Adhigarams');
    await expect(page.locator('.faq-item')).toHaveCount(4);
    await page.locator('.faq-item').first().click();
    await expect(page.locator('.faq-item').first()).toContainText('What is Adhigaram 1 in Thirukkural?');
});

test('adhigaram index loads and links to chapter detail pages', async ({ page }) => {
    await page.goto('/adhigaram');

    await expect(page.locator('h1')).toContainText('Browse All 133 Adhigarams');
    await expect(page.locator('.adhigaram-hub-card[href="/adhigaram/1"]')).toBeVisible();
    await expect(page.locator('.adhigaram-hub-card')).toHaveCount(133);

    await page.locator('.adhigaram-hub-card[href="/adhigaram/108"]').click();
    await expect(page).toHaveURL(/\/adhigaram\/108$/);
});

test('widget docs page shows install snippet and preview', async ({ page }) => {
    await page.goto('/widgets/daily-kural');

    const defaultEmbedSection = page.locator('.widget-install').first();

    await expect(page.locator('h1')).toContainText('Customizable Thirukkural Widget');
    await expect(defaultEmbedSection.locator('.code-block')).toContainText('data-mode="random"');
    await expect(page.locator('.preview-card')).toHaveCount(5);
    await expect(page.locator('.preview-frame iframe').first()).toBeVisible();
});

test('home page highlights the widget feature', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.widget-feature-section h2')).toContainText('Embed Thirukkural Anywhere');
    await expect(page.locator('.widget-showcase-item')).toHaveCount(3);

    await page.locator('.widget-feature-actions .btn').first().click();
    await expect(page).toHaveURL(/\/widgets\/daily-kural$/);
});

test('public widget script can render a fixed kural embed', async ({ page }) => {
    await page.goto('/');
    const widgetScriptUrl = new URL('/widgets/daily-kural.js', page.url()).toString();

    await page.setContent(`
        <div id="widget-host"></div>
        <script
          src="${widgetScriptUrl}"
          data-target="#widget-host"
          data-kural="1"
          data-theme="light"
        ></script>
    `);

    const frame = page.frameLocator('iframe[title="Featured Thirukkural widget"]');
    await expect(frame.locator('.widget-title')).toContainText('Thirukkural 1');
    await expect(frame.locator('.widget-link')).toContainText('Read Thirukkural 1');
});

test('public widget script can render a random compact embed', async ({ page }) => {
    await page.goto('/');
    const widgetScriptUrl = new URL('/widgets/daily-kural.js', page.url()).toString();

    await page.setContent(`
        <div id="widget-host"></div>
        <script
          src="${widgetScriptUrl}"
          data-target="#widget-host"
          data-mode="random"
          data-layout="compact"
          data-language="english"
        ></script>
    `);

    const frame = page.frameLocator('iframe[title="Random Thirukkural widget"]');
    await expect(frame.locator('.widget-title')).toContainText(/Thirukkural \d+/);
    await expect(frame.locator('.widget-refresh')).toContainText('Show another');
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
    await expect(page.locator('.hero-search-input')).toHaveValue('108');

    const adhigaramCard = page.locator('.adhigaram-item[href="/adhigaram/108"]');
    await expect(adhigaramCard).toBeVisible();

    await adhigaramCard.click();
    await expect(page).toHaveURL(/\/adhigaram\/108$/);

    await page.goBack();
    const url = new URL(page.url());
    expect(url.pathname).toBe('/kurals');
    expect(url.searchParams.get('view')).toBe('adhigaram');
    expect(url.searchParams.get('q')).toBe('108');
    await expect(page.locator('.scope-toggle-adhigaram')).toHaveClass(/mat-button-toggle-checked/);
    await expect(page.locator('.hero-search-input')).toHaveValue('108');
});
