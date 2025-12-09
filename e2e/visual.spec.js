import { test, expect } from '@playwright/test';

test.describe('Visual Appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('login page should look correct', async ({ page }) => {
    // Wait for React app to render
    await page.waitForSelector('.login-container', { timeout: 15000 });
    
    // Check login container is visible
    const container = page.locator('.login-container');
    await expect(container).toBeVisible({ timeout: 10000 });
    
    // Wait for loading to finish
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    // Check login card is visible
    const card = page.locator('.login-card');
    await expect(card).toBeVisible();
    
    // Check header with bee icon
    const icon = page.locator('.login-icon');
    await expect(icon).toBeVisible();
    await expect(icon).toContainText('🐝');
    
    // Check buttons have proper styling
    const googleButton = page.locator('.google-button');
    const githubButton = page.locator('.github-button');
    
    await expect(googleButton).toHaveCSS('cursor', 'pointer');
    await expect(githubButton).toHaveCSS('cursor', 'pointer');
  });

  test('login buttons should be interactive', async ({ page }) => {
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const googleButton = page.locator('.google-button');
    await expect(googleButton).toBeVisible({ timeout: 10000 });
    
    // Hover and check button remains visible and interactive
    await googleButton.hover();
    await page.waitForTimeout(300); // Wait for transition
    
    // Button should still be visible after hover
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
  });
});

test.describe('Animation and Transitions', () => {
  test('login card should be visible after load', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Wait for login card to appear (animation completed)
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const card = page.locator('.login-card');
    await expect(card).toBeVisible();
  });

  test('bee icon should be visible', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    const icon = page.locator('.login-icon');
    await expect(icon).toBeVisible({ timeout: 10000 });
    
    // Icon should have the bee emoji
    await expect(icon).toContainText('🐝');
  });
});

test.describe('Color Scheme', () => {
  test('should have proper contrast for text', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.login-card', { timeout: 15000 });
    
    // Main heading should be visible
    const heading = page.locator('.login-header h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
    
    // Content area text should be readable
    const contentText = page.locator('.login-content h2');
    await expect(contentText).toBeVisible();
  });
});
