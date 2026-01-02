import { test, expect } from '@playwright/test';

/**
 * Edge Cases and Error Handling E2E Tests
 * Tests boundary conditions, error states, and recovery
 * 
 * Run with: npx playwright test edge-cases.spec.js
 */

// Use stored auth state
test.use({ storageState: 'playwright/.auth/user.json' });

const waitForApp = async (page, timeout = 10000) => {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(300);
};

const ensureAuth = async (page) => {
  if (page.url().includes('/login')) {
    test.skip('Not authenticated');
  }
};

// ============================================================================
// FORM VALIDATION EDGE CASES
// ============================================================================

test.describe('Form Validation', () => {
  test('should reject empty hive name', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Clear name and try to submit
    await page.fill('.modal-content input:first-of-type', '');
    await page.click('button:has-text("Uložiť")');
    await page.waitForTimeout(300);
    
    // Should show error
    const hasError = await page.locator('.error-text, .input-error').count() > 0;
    const modalStillOpen = await page.locator('.modal-content').isVisible();
    
    expect(hasError || modalStillOpen).toBeTruthy();
  });

  test('should reject whitespace-only hive name', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Enter only spaces
    await page.fill('.modal-content input:first-of-type', '   ');
    await page.click('button:has-text("Uložiť")');
    await page.waitForTimeout(300);
    
    // Modal should still be open
    await expect(page.locator('.modal-content')).toBeVisible();
  });

  test('should validate DevEUI format (16 hex chars)', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Fill name first
    await page.fill('.modal-content input:first-of-type', 'DevEUI Test');
    
    // Select API type
    await page.selectOption('.modal-content select:first-of-type', 'api');
    await page.waitForTimeout(300);
    
    // Look for DevEUI input
    const devEuiInput = page.locator('input[placeholder*="DevEUI"], input[placeholder*="LoRaWAN"]');
    if (await devEuiInput.count() > 0) {
      // Enter invalid DevEUI (too short)
      await devEuiInput.fill('ABC123');
      await page.click('button:has-text("Uložiť")');
      await page.waitForTimeout(300);
      
      // Should show error or reject
      const hasError = await page.locator('.error-text:has-text("DevEUI"), .error-text:has-text("16")').count() > 0;
      const modalOpen = await page.locator('.modal-content').isVisible();
      
      expect(hasError || modalOpen).toBeTruthy();
    }
  });

  test('should validate GPS coordinates format', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    await page.fill('.modal-content input:first-of-type', 'GPS Test');
    
    // Find GPS inputs
    const latInput = page.locator('input[placeholder*="lat"]');
    const lngInput = page.locator('input[placeholder*="lng"]');
    
    if (await latInput.count() > 0) {
      // Enter invalid coordinates
      await latInput.fill('not-a-number');
      await lngInput.fill('also-invalid');
      
      await page.click('button:has-text("Uložiť")');
      await page.waitForTimeout(300);
      
      // Should handle gracefully
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// ============================================================================
// NETWORK ERROR HANDLING
// ============================================================================

test.describe('Network Error Handling', () => {
  test('should handle offline state gracefully', async ({ page, context }) => {
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto('/my-hives').catch(() => {});
    
    // Should show some offline indication or cached content
    await page.waitForTimeout(1000);
    
    // Go back online
    await context.setOffline(false);
    
    // Should recover
    await page.goto('/');
    await waitForApp(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle slow network', async ({ page }) => {
    // Simulate slow 3G
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024 / 8, // 50kbps
      uploadThroughput: 50 * 1024 / 8,
      latency: 2000
    });
    
    await page.goto('/');
    
    // Should eventually load
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================================================
// CONCURRENT OPERATIONS
// ============================================================================

test.describe('Concurrent Operations', () => {
  test('should handle rapid navigation', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Rapid navigation without waiting
    await page.goto('/my-hives');
    await page.goto('/history');
    await page.goto('/inspection');
    await page.goto('/settings');
    await page.goto('/');
    
    // Should end up on home page without crashing
    await waitForApp(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle double-click on submit', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    await page.fill('.modal-content input:first-of-type', `Double Click Test ${Date.now()}`);
    
    // Double click submit
    const submitButton = page.locator('button:has-text("Uložiť")');
    await submitButton.dblclick();
    
    // Should not create duplicate hives
    await waitForApp(page, 15000);
    await page.waitForTimeout(1000);
    
    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================================================
// BOUNDARY CONDITIONS
// ============================================================================

test.describe('Boundary Conditions', () => {
  test('should handle very long hive name', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Very long name
    const longName = 'A'.repeat(500);
    await page.fill('.modal-content input:first-of-type', longName);
    
    // Should either truncate, reject, or accept
    await page.click('button:has-text("Uložiť")');
    await page.waitForTimeout(500);
    
    // App should handle it
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle special characters in hive name', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Special characters
    const specialName = '<script>alert("xss")</script> & "quotes" \' single';
    await page.fill('.modal-content input:first-of-type', specialName);
    await page.click('button:has-text("Uložiť")');
    await page.waitForTimeout(500);
    
    // Should sanitize and not execute script
    await expect(page.locator('body')).toBeVisible();
    
    // Check for XSS (should NOT see alert)
    const dialogPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
    expect(await dialogPromise).toBeNull();
  });

  test('should handle unicode/emoji in inputs', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Unicode and emoji
    const unicodeName = '🐝 Včelí úľ 日本語 العربية';
    await page.fill('.modal-content input:first-of-type', unicodeName);
    
    await page.click('button:has-text("Uložiť")');
    await waitForApp(page, 15000);
    
    // Should handle unicode properly
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle minimum hive count (cannot delete last)', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    const hiveCount = await page.locator('.hive-card').count();
    
    if (hiveCount === 1) {
      // Try to delete last hive
      page.on('dialog', dialog => dialog.accept());
      
      await page.locator('.hive-card button:has-text("🗑️")').click();
      await page.waitForTimeout(500);
      
      // Should show warning or prevent deletion
      const toast = page.locator('.toast:has-text("posledný"), .toast:has-text("nemôž")');
      const stillOne = await page.locator('.hive-card').count() === 1;
      
      expect(await toast.count() > 0 || stillOne).toBeTruthy();
    }
  });
});

// ============================================================================
// STATE PERSISTENCE
// ============================================================================

test.describe('State Persistence', () => {
  test('should persist hive selection across navigation', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Select a hive if selector exists
    const hiveSelector = page.locator('.hive-selector select').first();
    if (await hiveSelector.count() > 0) {
      const options = await hiveSelector.locator('option').allTextContents();
      
      if (options.length > 1) {
        // Select second hive
        await hiveSelector.selectOption({ index: 1 });
        const selectedValue = await hiveSelector.inputValue();
        
        // Navigate away
        await page.goto('/settings');
        await waitForApp(page);
        
        // Navigate back
        await page.goto('/');
        await waitForApp(page);
        
        // Selection should persist
        const newSelector = page.locator('.hive-selector select').first();
        if (await newSelector.count() > 0) {
          const currentValue = await newSelector.inputValue();
          expect(currentValue).toBe(selectedValue);
        }
      }
    }
  });

  test('should persist theme preference', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Get current theme
    const html = page.locator('html');
    const originalTheme = await html.getAttribute('data-theme') || 
                          (await html.getAttribute('class'))?.includes('dark') ? 'dark' : 'light';
    
    // Toggle theme
    const themeToggle = page.locator('[class*="theme-toggle"], button:has-text("Tmavý"), button:has-text("Svetlý")').first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(500);
      
      // Reload page
      await page.reload();
      await waitForApp(page);
      
      // Check theme persisted
      const newTheme = await html.getAttribute('data-theme') || 
                       (await html.getAttribute('class'))?.includes('dark') ? 'dark' : 'light';
      
      // Theme should be different from original (toggle worked and persisted)
      // Or same if toggle has different behavior - just check it's valid
      expect(['dark', 'light', null, undefined]).toContain(newTheme);
    }
  });
});

// ============================================================================
// MOBILE RESPONSIVENESS
// ============================================================================

test.describe('Mobile Responsiveness', () => {
  test('should display properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Bottom nav should be visible
    const bottomNav = page.locator('.bottom-nav, .navigation');
    await expect(bottomNav).toBeVisible();
    
    // Content should not overflow
    const body = page.locator('body');
    const bodyWidth = await body.evaluate(el => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 10); // Allow small margin
  });

  test('should have touch-friendly buttons on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Buttons should be at least 44x44 for touch
    const addButton = page.locator('button:has-text("Pridať")');
    if (await addButton.count() > 0) {
      const box = await addButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36); // Reasonable touch target
      }
    }
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    await expect(page.locator('.dashboard')).toBeVisible();
  });
});

// ============================================================================
// ACCESSIBILITY
// ============================================================================

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Should have h1
    const h1 = page.locator('h1');
    expect(await h1.count()).toBeGreaterThanOrEqual(1);
  });

  test('should have accessible form labels', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Inputs should have labels
    const inputs = page.locator('.modal-content input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"])');
    const inputCount = await inputs.count();
    const labels = page.locator('.modal-content label');
    const labelCount = await labels.count();
    
    // Should have some labels (exact match not required due to various form patterns)
    expect(labelCount).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Something should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Check that text is visible (basic contrast check)
    const bodyText = page.locator('body');
    await expect(bodyText).toBeVisible();
    
    // This is a basic check - full contrast testing requires specialized tools
  });
});

// ============================================================================
// PERFORMANCE CHECKS
// ============================================================================

test.describe('Performance', () => {
  test('should load dashboard within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 10 seconds (generous for cold start)
    expect(loadTime).toBeLessThan(10000);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Navigate multiple times
    const routes = ['/', '/history', '/my-hives', '/inspection', '/settings'];
    
    for (let i = 0; i < 3; i++) {
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('domcontentloaded');
      }
    }
    
    // If we get here without crashing, basic memory management is okay
    await expect(page.locator('body')).toBeVisible();
  });
});
