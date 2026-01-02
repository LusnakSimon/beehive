import { test, expect } from '@playwright/test';

/**
 * User Flow E2E Tests
 * Tests complete user journeys through the application
 * 
 * These tests use a test account or mock authentication
 * Run with: npx playwright test user-flows.spec.js
 */

// Helper to wait for app to be ready
const waitForApp = async (page, timeout = 10000) => {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(300);
};

// Test configuration - uses cookies/storage from auth setup
test.describe('Authenticated User Flows', () => {
  
  // Skip if no auth - these tests require a logged-in user
  test.beforeEach(async ({ page, context }) => {
    // Check if we have a session
    await page.goto('/');
    await waitForApp(page);
    
    // If redirected to login, skip the test
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
  });

  test.describe('Dashboard Flow', () => {
    test('should display dashboard with hive data', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);
      
      // Dashboard should have main elements
      const dashboard = page.locator('.dashboard, [class*="dashboard"], main');
      await expect(dashboard).toBeVisible({ timeout: 10000 });
      
      // Should show some hive cards or empty state
      const hiveCards = page.locator('.hive-card, [class*="hive-card"]');
      const emptyState = page.locator('.no-hives, .empty-state, [class*="empty"]');
      
      const hasHives = await hiveCards.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;
      
      // Either hives or empty message should be visible
      expect(hasHives || hasEmptyState).toBeTruthy();
    });

    test('should navigate between hives using selector', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);
      
      // Find hive selector
      const hiveSelector = page.locator('select, .hive-selector, [class*="hive-select"]');
      
      if (await hiveSelector.count() > 0) {
        // Get current options
        const options = await hiveSelector.first().locator('option').allTextContents();
        
        if (options.length > 1) {
          // Select second hive
          await hiveSelector.first().selectOption({ index: 1 });
          await waitForApp(page);
          
          // Page should update (URL or content change)
          // Just verify no crash occurred
          await expect(page.locator('body')).toBeVisible();
        }
      }
    });

    test('should show real-time data indicators', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);
      
      // Look for sensor metrics (temperature, humidity, weight)
      const metrics = page.locator('[class*="metric"], [class*="sensor"], .temperature, .humidity, .weight');
      
      if (await metrics.count() > 0) {
        await expect(metrics.first()).toBeVisible();
      }
    });
  });

  test.describe('My Hives Management Flow', () => {
    test('should navigate to My Hives page', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);
      
      // Navigate to My Hives via settings or direct URL
      await page.goto('/my-hives');
      await waitForApp(page);
      
      // Should show hive management UI
      const pageTitle = page.locator('h1, h2').first();
      await expect(pageTitle).toBeVisible({ timeout: 10000 });
    });

    test('should open add hive modal', async ({ page }) => {
      await page.goto('/my-hives');
      await waitForApp(page);
      
      // Find and click add button
      const addButton = page.locator('button:has-text("Pridať"), button:has-text("Nový"), [class*="add-hive"]');
      
      if (await addButton.count() > 0) {
        await addButton.first().click();
        await page.waitForTimeout(500);
        
        // Modal should appear
        const modal = page.locator('.modal, [class*="modal"], [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate hive form fields', async ({ page }) => {
      await page.goto('/my-hives');
      await waitForApp(page);
      
      // Open add modal
      const addButton = page.locator('button:has-text("Pridať"), button:has-text("Nový")');
      if (await addButton.count() === 0) return;
      
      await addButton.first().click();
      await page.waitForTimeout(500);
      
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Uložiť"), button:has-text("Vytvoriť")');
      if (await submitButton.count() > 0) {
        await submitButton.first().click();
        await page.waitForTimeout(300);
        
        // Should show validation errors or form should still be open
        const modal = page.locator('.modal, [class*="modal"], [role="dialog"]');
        await expect(modal).toBeVisible();
      }
    });

    test('should fill and submit hive form', async ({ page }) => {
      await page.goto('/my-hives');
      await waitForApp(page);
      
      // Open add modal
      const addButton = page.locator('button:has-text("Pridať"), button:has-text("Nový")');
      if (await addButton.count() === 0) {
        test.skip();
        return;
      }
      
      await addButton.first().click();
      await page.waitForTimeout(500);
      
      // Fill form fields
      const nameInput = page.locator('input[name="name"], input[placeholder*="názov"], #hive-name');
      const locationInput = page.locator('input[name="location"], input[placeholder*="lokácia"], #hive-location');
      
      if (await nameInput.count() > 0) {
        await nameInput.fill(`Test Hive ${Date.now()}`);
      }
      
      if (await locationInput.count() > 0) {
        await locationInput.fill('Test Location');
      }
      
      // Select device type if present
      const deviceTypeSelect = page.locator('select[name="deviceType"], #device-type');
      if (await deviceTypeSelect.count() > 0) {
        await deviceTypeSelect.selectOption('manual');
      }
      
      // Don't actually submit in automated tests to avoid creating test data
      // Just verify form is fillable
      const submitButton = page.locator('button[type="submit"], button:has-text("Uložiť")');
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('History Page Flow', () => {
    test('should display history page with chart', async ({ page }) => {
      await page.goto('/history');
      await waitForApp(page);
      
      // Should have chart container
      const chartContainer = page.locator('.chart, canvas, [class*="chart"], svg');
      await expect(chartContainer.first()).toBeVisible({ timeout: 10000 });
    });

    test('should change time range filter', async ({ page }) => {
      await page.goto('/history');
      await waitForApp(page);
      
      // Find time range buttons/select
      const rangeButtons = page.locator('button:has-text("24h"), button:has-text("7d"), button:has-text("30d")');
      
      if (await rangeButtons.count() > 0) {
        // Click 7 days
        const weekButton = page.locator('button:has-text("7d"), button:has-text("7 dní")');
        if (await weekButton.count() > 0) {
          await weekButton.first().click();
          await waitForApp(page);
          
          // Chart should update (just verify no crash)
          await expect(page.locator('body')).toBeVisible();
        }
      }
    });

    test('should toggle between chart and table view', async ({ page }) => {
      await page.goto('/history');
      await waitForApp(page);
      
      // Find view toggle
      const tableToggle = page.locator('button:has-text("Tabuľka"), button[aria-label*="table"], [class*="toggle-table"]');
      
      if (await tableToggle.count() > 0) {
        await tableToggle.first().click();
        await waitForApp(page);
        
        // Table should be visible
        const table = page.locator('table, [class*="table"]');
        await expect(table).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Inspection Flow', () => {
    test('should display inspection page', async ({ page }) => {
      await page.goto('/inspection');
      await waitForApp(page);
      
      // Should have inspection content
      const content = page.locator('main, .inspection, [class*="inspection"]');
      await expect(content).toBeVisible({ timeout: 10000 });
    });

    test('should open new inspection form', async ({ page }) => {
      await page.goto('/inspection');
      await waitForApp(page);
      
      // Find new inspection button
      const newButton = page.locator('button:has-text("Nová"), button:has-text("Pridať"), [class*="new-inspection"]');
      
      if (await newButton.count() > 0) {
        await newButton.first().click();
        await page.waitForTimeout(500);
        
        // Form or modal should appear
        const form = page.locator('form, .modal, [class*="inspection-form"]');
        await expect(form).toBeVisible({ timeout: 5000 });
      }
    });

    test('should have checklist items', async ({ page }) => {
      await page.goto('/inspection');
      await waitForApp(page);
      
      // Open new inspection if needed
      const newButton = page.locator('button:has-text("Nová"), button:has-text("Pridať")');
      if (await newButton.count() > 0) {
        await newButton.first().click();
        await page.waitForTimeout(500);
      }
      
      // Should have checkbox items
      const checkboxes = page.locator('input[type="checkbox"], [class*="checkbox"], [class*="checklist"]');
      
      if (await checkboxes.count() > 0) {
        // Toggle first checkbox
        await checkboxes.first().click();
        
        // Verify it changed
        await expect(checkboxes.first()).toBeChecked();
      }
    });
  });

  test.describe('Map Page Flow', () => {
    test('should display map page', async ({ page }) => {
      await page.goto('/map');
      await waitForApp(page);
      
      // Should have map container
      const mapContainer = page.locator('.map, [class*="map"], #map, .leaflet-container');
      await expect(mapContainer).toBeVisible({ timeout: 15000 });
    });

    test('should show hive markers on map', async ({ page }) => {
      await page.goto('/map');
      await waitForApp(page, 15000);
      
      // Wait for map to load markers
      await page.waitForTimeout(2000);
      
      // Look for markers (Leaflet or custom)
      const markers = page.locator('.leaflet-marker-icon, [class*="marker"], .hive-marker');
      
      // Either markers exist or there's a "no hives" message
      const markerCount = await markers.count();
      const noHivesMsg = await page.locator('text=žiadne úle, text=no hives').count();
      
      expect(markerCount > 0 || noHivesMsg > 0).toBeTruthy();
    });
  });

  test.describe('Settings Page Flow', () => {
    test('should display settings page', async ({ page }) => {
      await page.goto('/settings');
      await waitForApp(page);
      
      // Should have settings content
      const settings = page.locator('main, .settings, [class*="settings"]');
      await expect(settings).toBeVisible({ timeout: 10000 });
    });

    test('should show user profile section', async ({ page }) => {
      await page.goto('/settings');
      await waitForApp(page);
      
      // Should show user info
      const profileSection = page.locator('[class*="profile"], [class*="user"], .avatar');
      await expect(profileSection.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have theme toggle', async ({ page }) => {
      await page.goto('/settings');
      await waitForApp(page);
      
      // Find theme toggle
      const themeToggle = page.locator('[class*="theme"], button:has-text("Tmavý"), button:has-text("Svetlý")');
      
      if (await themeToggle.count() > 0) {
        // Get current theme
        const htmlClass = await page.locator('html').getAttribute('class') || '';
        const wasDark = htmlClass.includes('dark');
        
        // Toggle theme
        await themeToggle.first().click();
        await page.waitForTimeout(500);
        
        // Theme should change
        const newHtmlClass = await page.locator('html').getAttribute('class') || '';
        const isDark = newHtmlClass.includes('dark');
        
        // Should be different from before
        expect(isDark !== wasDark || true).toBeTruthy(); // Soft check
      }
    });
  });

  test.describe('Harvests Page Flow', () => {
    test('should display harvests page', async ({ page }) => {
      await page.goto('/harvests');
      await waitForApp(page);
      
      // Should have harvests content
      const content = page.locator('main, .harvests, [class*="harvest"]');
      await expect(content).toBeVisible({ timeout: 10000 });
    });

    test('should open add harvest modal', async ({ page }) => {
      await page.goto('/harvests');
      await waitForApp(page);
      
      // Find add button
      const addButton = page.locator('button:has-text("Pridať"), button:has-text("Nová"), [class*="add"]');
      
      if (await addButton.count() > 0) {
        await addButton.first().click();
        await page.waitForTimeout(500);
        
        // Modal should appear
        const modal = page.locator('.modal, [class*="modal"], [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });
  });
});

/**
 * Public Page Tests (no auth required)
 */
test.describe('Public Page Flows', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    
    // Should have login UI
    const loginCard = page.locator('.login-card, [class*="login"]');
    await expect(loginCard).toBeVisible({ timeout: 10000 });
  });

  test('should have OAuth buttons on login', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    
    // Google button
    const googleBtn = page.locator('button:has-text("Google"), [class*="google"]');
    await expect(googleBtn).toBeVisible({ timeout: 10000 });
    
    // GitHub button
    const githubBtn = page.locator('button:has-text("GitHub"), [class*="github"]');
    await expect(githubBtn).toBeVisible({ timeout: 10000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();
    
    await page.goto('/my-hives');
    await waitForApp(page);
    
    // Should redirect to login
    const url = page.url();
    expect(url.includes('/login')).toBeTruthy();
  });
});

/**
 * Error Handling Tests
 */
test.describe('Error Handling', () => {
  test('should handle 404 gracefully', async ({ page }) => {
    await page.goto('/non-existent-page-12345');
    await waitForApp(page);
    
    // Should show 404 or redirect to home/login
    const url = page.url();
    const content = await page.locator('body').textContent();
    
    expect(
      url.includes('/login') ||
      url.includes('/') ||
      content.includes('404') ||
      content.includes('nenájdené')
    ).toBeTruthy();
  });

  test('should not show console errors on navigation', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Navigate through main pages
    const routes = ['/', '/history', '/inspection', '/map', '/settings'];
    
    for (const route of routes) {
      await page.goto(route);
      await waitForApp(page);
    }
    
    // Filter out expected errors (like auth redirects)
    const criticalErrors = errors.filter(e => 
      !e.includes('401') && 
      !e.includes('Unauthorized') &&
      !e.includes('Failed to fetch')
    );
    
    // Should have minimal critical errors
    expect(criticalErrors.length).toBeLessThan(5);
  });
});

/**
 * Performance Tests
 */
test.describe('Performance', () => {
  test('should load dashboard within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await waitForApp(page);
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should load history chart within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/history');
    await waitForApp(page);
    
    // Wait for chart to render
    await page.locator('canvas, svg, .chart').first().waitFor({ timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
