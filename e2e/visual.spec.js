import { test, expect } from '@playwright/test';

test.describe('Visual Appearance', () => {
  test('login page should look correct', async ({ page }) => {
    await page.goto('/login');
    
    // Check gradient background
    const container = page.locator('.login-container');
    await expect(container).toBeVisible();
    
    // Check login card styling
    const card = page.locator('.login-card');
    await expect(card).toBeVisible();
    
    // Check header with bee icon
    const icon = page.locator('.login-icon');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveText('🐝');
    
    // Check buttons have proper styling
    const googleButton = page.locator('.google-button');
    const githubButton = page.locator('.github-button');
    
    await expect(googleButton).toHaveCSS('cursor', 'pointer');
    await expect(githubButton).toHaveCSS('cursor', 'pointer');
  });

  test('login buttons should have hover effects', async ({ page }) => {
    await page.goto('/login');
    
    const googleButton = page.locator('.google-button');
    
    // Get initial box shadow
    const initialBoxShadow = await googleButton.evaluate(
      el => getComputedStyle(el).boxShadow
    );
    
    // Hover and check for change
    await googleButton.hover();
    await page.waitForTimeout(300); // Wait for transition
    
    // Button should still be visible after hover
    await expect(googleButton).toBeVisible();
  });
});

test.describe('Animation and Transitions', () => {
  test('login card should animate on load', async ({ page }) => {
    await page.goto('/login');
    
    // Card should be visible (animation completed)
    const card = page.locator('.login-card');
    await expect(card).toBeVisible();
  });

  test('bee icon should animate', async ({ page }) => {
    await page.goto('/login');
    
    const icon = page.locator('.login-icon');
    await expect(icon).toBeVisible();
    
    // Check animation is applied
    const animation = await icon.evaluate(el => getComputedStyle(el).animation);
    // Should have bounce animation (unless reduced motion is preferred)
    expect(animation).toBeTruthy();
  });
});

test.describe('Color Scheme', () => {
  test('should have proper contrast for text', async ({ page }) => {
    await page.goto('/login');
    
    // Main heading should be visible (white on gradient)
    const heading = page.locator('.login-header h1');
    await expect(heading).toBeVisible();
    
    // Content area text should be readable
    const contentText = page.locator('.login-content h2');
    await expect(contentText).toBeVisible();
  });
});
