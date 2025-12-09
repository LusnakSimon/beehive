import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with branding', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h1')).toHaveText('eBeeHive');
    
    // Check subtitle
    await expect(page.locator('.login-header p')).toHaveText('Inteligentný systém monitorovania úľov');
    
    // Check login section heading
    await expect(page.locator('.login-content h2')).toHaveText('Prihlásenie');
  });

  test('should have Google login button', async ({ page }) => {
    const googleButton = page.locator('button.google-button');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toHaveText(/Pokračovať s Google/);
    await expect(googleButton).toHaveAttribute('aria-label', 'Prihlásiť sa pomocou účtu Google');
  });

  test('should have GitHub login button', async ({ page }) => {
    const githubButton = page.locator('button.github-button');
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toHaveText(/Pokračovať s GitHub/);
    await expect(githubButton).toHaveAttribute('aria-label', 'Prihlásiť sa pomocou účtu GitHub');
  });

  test('should display account benefits', async ({ page }) => {
    const infoSection = page.locator('.login-info');
    await expect(infoSection).toBeVisible();
    
    // Check each benefit is listed
    await expect(infoSection.locator('li')).toHaveCount(4);
    await expect(infoSection.locator('text=Zabezpečené uloženie')).toBeVisible();
    await expect(infoSection.locator('text=Prístup z viacerých zariadení')).toBeVisible();
    await expect(infoSection.locator('text=Personalizované notifikácie')).toBeVisible();
    await expect(infoSection.locator('text=Správa tvojich úľov')).toBeVisible();
  });

  test('should have privacy policy link', async ({ page }) => {
    const privacyLink = page.locator('a[href="/privacy"]');
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('target', '_blank');
    await expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    // Check login card is visible and properly sized on mobile
    const loginCard = page.locator('.login-card');
    await expect(loginCard).toBeVisible();
    
    // Card should be near full width on mobile
    const cardBox = await loginCard.boundingBox();
    const viewport = page.viewportSize();
    expect(cardBox.width).toBeGreaterThan(viewport.width * 0.9);
  });

  test('should have proper focus states for accessibility', async ({ page }) => {
    // Tab to Google button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Skip any other focusable elements
    
    // Check that a button is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should show login link when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login or show login link
    const loginLink = page.locator('a[href="/login"]');
    // Either on login page or has login link visible
    const isOnLoginPage = page.url().includes('/login');
    const hasLoginLink = await loginLink.isVisible().catch(() => false);
    
    expect(isOnLoginPage || hasLoginLink).toBeTruthy();
  });
});

test.describe('App Shell', () => {
  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors (like API calls failing without backend)
    const unexpectedErrors = errors.filter(err => 
      !err.includes('Failed to fetch') && 
      !err.includes('NetworkError') &&
      !err.includes('ECONNREFUSED')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/login');
    
    // Check viewport meta
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
    
    // Check title exists
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have manifest for PWA', async ({ page }) => {
    await page.goto('/login');
    
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', '/manifest.json');
  });
});
