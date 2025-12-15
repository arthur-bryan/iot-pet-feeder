import { test, expect } from '@playwright/test';

// Set up demo mode to bypass authentication
test.beforeEach(async ({ page }) => {
    // Intercept env-config.js to set demo mode
    await page.route('**/env-config.js', async route => {
        await route.fulfill({
            contentType: 'application/javascript',
            body: `window.ENV = {
                VITE_ENVIRONMENT: 'demo',
                VITE_API_BASE_URL: 'http://localhost:3000'
            };`
        });
    });
});

test.describe('Pet Feeder App', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should load the main page', async ({ page }) => {
        await expect(page).toHaveTitle('Pet Feeder');
    });

    test('should display the header with app title', async ({ page }) => {
        const title = page.locator('h1');
        await expect(title).toContainText('Pet Feeder');
    });

    test('should have theme toggle button', async ({ page }) => {
        const themeButton = page.locator('#themeToggleButton');
        await expect(themeButton).toBeVisible();
    });

    test('should toggle dark mode', async ({ page }) => {
        const html = page.locator('html');
        const themeButton = page.locator('#themeToggleButton');

        // Wait for page to fully load
        await page.waitForLoadState('domcontentloaded');

        // Initial state might be light or dark based on system preference
        const initialDark = await html.evaluate(el => el.classList.contains('dark'));

        // Click theme toggle
        await themeButton.click();

        // Wait for theme to toggle
        await page.waitForTimeout(100);

        // Check class toggled
        const afterToggle = await html.evaluate(el => el.classList.contains('dark'));
        expect(afterToggle).toBe(!initialDark);
    });

    test('should have navigation buttons', async ({ page }) => {
        // Schedules button
        const schedulesButton = page.locator('button[onclick*="schedules.html"]');
        await expect(schedulesButton).toBeVisible();

        // Settings button
        const settingsButton = page.locator('button[onclick*="settings.html"]');
        await expect(settingsButton).toBeVisible();
    });

    test('should navigate to schedules page', async ({ page }) => {
        await page.locator('button[onclick*="schedules.html"]').click();
        await page.waitForURL('**/schedules.html');
        await expect(page).toHaveTitle('Feed Schedules - Pet Feeder');
    });

    test('should navigate to settings page', async ({ page }) => {
        await page.locator('button[onclick*="settings.html"]').click();
        await page.waitForURL('**/settings.html');
        await expect(page).toHaveTitle('Settings - Pet Feeder');
    });

    test('should display device status card', async ({ page }) => {
        const statusCard = page.locator('text=Device Status');
        await expect(statusCard).toBeVisible();
    });

    test('should display current weight card', async ({ page }) => {
        const weightCard = page.locator('text=Current Weight');
        await expect(weightCard).toBeVisible();
    });

    test('should display quick feed button', async ({ page }) => {
        const feedButton = page.locator('#feedButton');
        await expect(feedButton).toBeVisible();
        await expect(feedButton).toContainText('Feed Now');
    });

    test('should display feeding history section', async ({ page }) => {
        const historySection = page.getByRole('heading', { name: 'Feeding History' });
        await expect(historySection).toBeVisible();
    });

    test('should have view type selector', async ({ page }) => {
        const viewSelect = page.locator('#viewTypeSelect');
        await expect(viewSelect).toBeVisible();
    });

    test('should switch between table and chart view', async ({ page }) => {
        const viewSelect = page.locator('#viewTypeSelect');

        // Select chart view
        await viewSelect.selectOption('chart');

        // Chart container should be visible
        const chartContainer = page.locator('#chartViewContainer');
        await expect(chartContainer).toBeVisible();

        // Select table view
        await viewSelect.selectOption('table');

        // Table container should be visible
        const tableContainer = page.locator('#tableViewContainer');
        await expect(tableContainer).toBeVisible();
    });

    test('should have refresh button', async ({ page }) => {
        const refreshButton = page.locator('#refreshButton');
        await expect(refreshButton).toBeVisible();
    });

    test('should have proper ARIA labels on icon buttons', async ({ page }) => {
        const refreshButton = page.locator('#refreshButton');
        await expect(refreshButton).toHaveAttribute('aria-label', 'Refresh all data');

        const themeButton = page.locator('#themeToggleButton');
        await expect(themeButton).toHaveAttribute('aria-label', 'Toggle dark mode');
    });

    test('should have CSP meta tag', async ({ page }) => {
        const csp = page.locator('meta[http-equiv="Content-Security-Policy"]');
        await expect(csp).toBeAttached();
    });
});

test.describe('Pet Feeder Schedules Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/schedules.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should load the schedules page', async ({ page }) => {
        await expect(page).toHaveTitle('Feed Schedules - Pet Feeder');
    });

    test('should have add schedule button', async ({ page }) => {
        const addButton = page.locator('#addScheduleButton');
        await expect(addButton).toBeVisible();
    });

    test('should have back to dashboard button', async ({ page }) => {
        const backButton = page.locator('[aria-label="Back to dashboard"]');
        await expect(backButton).toBeVisible();
    });

    test('should open schedule modal on add click', async ({ page }) => {
        const addButton = page.locator('#addScheduleButton');
        await addButton.click();

        // Wait for modal animation
        await page.waitForTimeout(200);

        const modal = page.locator('#scheduleModal');
        await expect(modal).not.toHaveClass(/hidden/);
    });

    test('should have form fields in schedule modal', async ({ page }) => {
        const addButton = page.locator('#addScheduleButton');
        await addButton.click();

        // Wait for modal to be visible
        await page.waitForTimeout(300);

        // Check for form elements (schedule form has date, time, feedCycles)
        await expect(page.locator('#scheduleDate')).toBeVisible();
        await expect(page.locator('#scheduleTime')).toBeVisible();
        await expect(page.locator('#feedCycles')).toBeVisible();
    });

    test('should close modal on cancel', async ({ page }) => {
        const addButton = page.locator('#addScheduleButton');
        await addButton.click();

        await page.waitForTimeout(300);

        // cancelButton is the correct ID
        const cancelButton = page.locator('#cancelButton');
        await cancelButton.click();

        await page.waitForTimeout(300);

        const modal = page.locator('#scheduleModal');
        await expect(modal).toHaveClass(/hidden/);
    });
});

test.describe('Pet Feeder Settings Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should load the settings page', async ({ page }) => {
        await expect(page).toHaveTitle('Settings - Pet Feeder');
    });

    test('should have back to dashboard button', async ({ page }) => {
        const backButton = page.locator('[aria-label="Back to dashboard"]');
        await expect(backButton).toBeVisible();
    });

    test('should display notification settings', async ({ page }) => {
        const notificationsHeading = page.getByRole('heading', { name: 'Email Notifications' });
        await expect(notificationsHeading).toBeVisible();
    });

    test('should display device settings', async ({ page }) => {
        const deviceHeading = page.getByRole('heading', { name: 'Device Settings' });
        await expect(deviceHeading).toBeVisible();
    });
});
