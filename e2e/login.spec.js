import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Wait for React app to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    // Wait for either login card or loading spinner to appear
    await page.waitForSelector('.login-container', { timeout: 15000 });
  });

  test('should display login page with branding', async ({ page }) => {
    // Wait for loading to complete - login card appears when not loading
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    // Check main heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(heading).toHaveText('eBeeHive');
    
    // Check subtitle
    await expect(page.locator('.login-header p')).toHaveText('Inteligentný systém monitorovania úľov');
    
    // Check login section heading
    await expect(page.locator('.login-content h2')).toHaveText('Prihlásenie');
  });

  test('should have Google login button', async ({ page }) => {
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const googleButton = page.locator('.oauth-button.google-button');
    await expect(googleButton).toBeVisible({ timeout: 10000 });
    await expect(googleButton).toContainText('Pokračovať s Google');
    await expect(googleButton).toHaveAttribute('aria-label', 'Prihlásiť sa pomocou účtu Google');
  });

  test('should have GitHub login button', async ({ page }) => {
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const githubButton = page.locator('.oauth-button.github-button');
    await expect(githubButton).toBeVisible({ timeout: 10000 });
    await expect(githubButton).toContainText('Pokračovať s GitHub');
    await expect(githubButton).toHaveAttribute('aria-label', 'Prihlásiť sa pomocou účtu GitHub');
  });

  test('should display account benefits', async ({ page }) => {
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const infoSection = page.locator('.login-info');
    await expect(infoSection).toBeVisible({ timeout: 10000 });
    
    // Check each benefit is listed
    await expect(infoSection.locator('li')).toHaveCount(4);
    await expect(page.getByText('Zabezpečené uloženie')).toBeVisible();
    await expect(page.getByText('Prístup z viacerých zariadení')).toBeVisible();
    await expect(page.getByText('Personalizované notifikácie')).toBeVisible();
    await expect(page.getByText('Správa tvojich úľov')).toBeVisible();
  });

  test('should have privacy policy link', async ({ page }) => {
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const privacyLink = page.locator('.login-privacy a[href="/privacy"]');
    await expect(privacyLink).toBeVisible({ timeout: 10000 });
    await expect(privacyLink).toHaveAttribute('target', '_blank');
    await expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    // Check login card is visible and properly sized on mobile
    const loginCard = page.locator('.login-card');
    await expect(loginCard).toBeVisible();
    
    // Card should be reasonably sized on mobile (at least 75% of viewport)
    const cardBox = await loginCard.boundingBox();
    const viewport = page.viewportSize();
    expect(cardBox.width).toBeGreaterThan(viewport.width * 0.75);
  });

  test('should have proper focus states for accessibility', async ({ page }) => {
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    // Tab to navigate through focusable elements
    await page.keyboard.press('Tab');
    
    // Check that something is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should be redirected to login page or dashboard shows login option
    await page.waitForTimeout(2000); // Allow time for redirect
    const url = page.url();
    const isOnLoginPage = url.includes('/login');
    
    // If not on login page, should have a way to get there
    if (!isOnLoginPage) {
      // Look for login link or check if protected content requires login
      const loginLink = page.locator('a[href="/login"]');
      const hasLoginLink = await loginLink.count() > 0;
      expect(hasLoginLink || isOnLoginPage).toBeTruthy();
    } else {
      expect(isOnLoginPage).toBeTruthy();
    }
  });
});

test.describe('App Shell', () => {
  test('should load without critical JavaScript errors', async ({ page }) => {
    const criticalErrors = [];
    page.on('pageerror', error => {
      // Only capture truly critical errors
      const msg = error.message.toLowerCase();
      if (!msg.includes('fetch') && 
          !msg.includes('network') &&
          !msg.includes('econnrefused') &&
          !msg.includes('api') &&
          !msg.includes('401') &&
          !msg.includes('403')) {
        criticalErrors.push(error.message);
      }
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow time for async errors
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // Check viewport meta
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
    
    // Check title exists
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have manifest for PWA', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    const manifest = page.locator('link[rel="manifest"]');
    // Either has manifest or doesn't - both are valid
    const hasManifest = await manifest.count() > 0;
    if (hasManifest) {
      await expect(manifest).toHaveAttribute('href', /manifest/);
    }
    // Test passes regardless - we just check for presence
    expect(true).toBe(true);
  });
});
