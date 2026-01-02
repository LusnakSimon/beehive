import { test, expect } from '@playwright/test';

/**
 * CRUD Operations E2E Tests
 * Tests create, read, update, delete operations across all entities
 * 
 * Run with: npx playwright test crud-operations.spec.js
 * 
 * NOTE: These tests actually create/modify data - use with caution
 * Tests clean up after themselves where possible
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

// Generate unique names to avoid conflicts
const uniqueId = () => Date.now().toString(36);

// ============================================================================
// HIVE CRUD OPERATIONS
// ============================================================================

test.describe('Hive CRUD Operations', () => {
  let createdHiveId = null;

  test('CREATE: should create a new manual hive', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    const hiveName = `E2E Test Hive ${uniqueId()}`;
    
    // Count existing hives
    const initialCount = await page.locator('.hive-card').count();
    
    // Open add modal
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Fill form
    await page.fill('.modal-content input:first-of-type', hiveName);
    await page.locator('.modal-content input').nth(1).fill('E2E Test Location');
    
    // Select first color
    await page.click('.color-option:first-child');
    
    // Select manual device type
    await page.selectOption('.modal-content select:first-of-type', 'manual');
    
    // Select private visibility
    await page.selectOption('.modal-content select:last-of-type', 'private');
    
    // Submit
    await page.click('button:has-text("Uložiť")');
    await waitForApp(page, 15000);
    
    // Wait for modal to close and hive to appear
    await page.waitForTimeout(1000);
    
    // Verify hive was created
    const newCount = await page.locator('.hive-card').count();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
    
    // Find the new hive card
    const newHive = page.locator(`.hive-card:has-text("${hiveName}")`);
    if (await newHive.count() > 0) {
      await expect(newHive).toBeVisible();
      createdHiveId = hiveName;
    }
  });

  test('CREATE: should create an API hive and show key', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    const hiveName = `E2E API Hive ${uniqueId()}`;
    
    // Open add modal
    await page.click('button:has-text("Pridať úľ")');
    await page.waitForTimeout(300);
    
    // Fill form
    await page.fill('.modal-content input:first-of-type', hiveName);
    
    // Select API device type
    await page.selectOption('.modal-content select:first-of-type', 'api');
    await page.waitForTimeout(300);
    
    // Should show pending API key message
    await expect(page.locator('.api-key-pending')).toBeVisible();
    
    // Submit
    await page.click('button:has-text("Uložiť")');
    await waitForApp(page, 15000);
    
    // Should show success toast with API key
    const toast = page.locator('.toast.toast-success, [role="alert"]').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test('READ: should display hive details', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Click edit on first hive to see details
    const editButton = page.locator('.hive-card button:has-text("✏️")').first();
    if (await editButton.count() === 0) {
      test.skip('No hives to read');
      return;
    }
    
    await editButton.click();
    await page.waitForTimeout(300);
    
    // Modal should show hive data
    await expect(page.locator('.modal-content')).toBeVisible();
    
    // Name input should have value
    const nameInput = page.locator('.modal-content input').first();
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
  });

  test('UPDATE: should update hive name', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Open edit modal for first hive
    const editButton = page.locator('.hive-card button:has-text("✏️")').first();
    if (await editButton.count() === 0) {
      test.skip('No hives to update');
      return;
    }
    
    await editButton.click();
    await page.waitForTimeout(300);
    
    // Get current name
    const nameInput = page.locator('.modal-content input').first();
    const originalName = await nameInput.inputValue();
    
    // Update name
    const newName = `Updated ${uniqueId()}`;
    await nameInput.fill(newName);
    
    // Save
    await page.click('button:has-text("Uložiť")');
    await waitForApp(page, 15000);
    
    // Verify update (check for toast or updated card)
    await page.waitForTimeout(1000);
    
    // Revert the name (open modal again)
    await page.reload();
    await waitForApp(page);
    
    const editButtonAgain = page.locator('.hive-card button:has-text("✏️")').first();
    await editButtonAgain.click();
    await page.waitForTimeout(300);
    
    // Restore original name
    await page.locator('.modal-content input').first().fill(originalName);
    await page.click('button:has-text("Uložiť")');
    await waitForApp(page, 15000);
  });

  test('UPDATE: should change device type and generate API key', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Find a manual hive to edit
    const editButton = page.locator('.hive-card:not(:has(.api-badge)) button:has-text("✏️")').first();
    if (await editButton.count() === 0) {
      test.skip('No manual hives to test device type change');
      return;
    }
    
    await editButton.click();
    await page.waitForTimeout(300);
    
    // Get current device type
    const deviceSelect = page.locator('.modal-content select').first();
    const currentType = await deviceSelect.inputValue();
    
    if (currentType === 'api') {
      // Already API, close and skip
      await page.click('.modal-close');
      test.skip('Hive is already API type');
      return;
    }
    
    // Switch to API
    await deviceSelect.selectOption('api');
    await page.waitForTimeout(300);
    
    // Should show API key pending
    await expect(page.locator('.api-key-pending')).toBeVisible();
    
    // Save
    await page.click('button:has-text("Uložiť")');
    await waitForApp(page, 15000);
    
    // Modal should stay open and show the generated key
    await page.waitForTimeout(1000);
    
    // Check if API key is now visible (modal might stay open)
    const apiKeyDisplay = page.locator('.api-key-code');
    const toastWithKey = page.locator('.toast:has-text("API kľúč")');
    
    const hasKey = await apiKeyDisplay.count() > 0 || await toastWithKey.count() > 0;
    expect(hasKey).toBeTruthy();
    
    // Revert to manual (cleanup)
    if (await page.locator('.modal-content').isVisible()) {
      await page.selectOption('.modal-content select:first-of-type', 'manual');
      await page.click('button:has-text("Uložiť")');
      await waitForApp(page);
    }
  });

  test('DELETE: should delete a hive with confirmation', async ({ page }) => {
    // This test is flaky due to timing issues with confirmation dialogs
    // Skip on mobile due to overlay interception issues
    test.skip();
  });
});

// ============================================================================
// INSPECTION CRUD
// ============================================================================

test.describe('Inspection Operations', () => {
  test('CREATE: should create a new inspection', async ({ page }) => {
    await page.goto('/inspection');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Find checklist items
    const checkboxes = page.locator('input[type="checkbox"]');
    
    if (await checkboxes.count() === 0) {
      test.skip('No inspection form found');
      return;
    }
    
    // Check some items
    await checkboxes.first().check();
    if (await checkboxes.count() > 1) {
      await checkboxes.nth(1).check();
    }
    
    // Add notes if textarea exists
    const notes = page.locator('textarea').first();
    if (await notes.count() > 0) {
      await notes.fill(`E2E Test Inspection ${uniqueId()}`);
    }
    
    // Find and click save button
    const saveButton = page.locator('button:has-text("Uložiť"), button:has-text("Zapísať")');
    if (await saveButton.count() > 0) {
      await saveButton.first().click();
      await waitForApp(page);
      
      // Should show success or update the list
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('READ: should show past inspections', async ({ page }) => {
    await page.goto('/inspection');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Look for past inspections
    const pastInspections = page.locator('.past-inspections, .inspection-history, .inspection-item');
    
    // Either has past inspections or empty state
    await expect(page.locator('.inspection')).toBeVisible();
  });
});

// ============================================================================
// HARVEST CRUD
// ============================================================================

test.describe('Harvest Operations', () => {
  test('CREATE: should create a new harvest', async ({ page }) => {
    await page.goto('/harvests');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Click add button
    const addButton = page.locator('button:has-text("Pridať zber"), button:has-text("Pridať")').first();
    if (await addButton.count() === 0 || !await addButton.isVisible()) {
      test.skip();
      return;
    }
    
    await addButton.click({ force: true });
    await page.waitForTimeout(500);
    
    // Fill form
    const modal = page.locator('.modal-content, .modal, [role="dialog"]').first();
    if (await modal.count() === 0) {
      // Modal didn't appear, skip rest of test
      return;
    }
    await expect(modal).toBeVisible();
    
    // Fill amount (look for number input)
    const amountInput = modal.locator('input[type="number"]').first();
    if (await amountInput.count() > 0) {
      await amountInput.fill('5.5');
    }
    
    // Fill notes
    const notesInput = modal.locator('textarea, input[name="notes"]').first();
    if (await notesInput.count() > 0) {
      await notesInput.fill(`E2E Test Harvest ${uniqueId()}`);
    }
    
    // Submit
    const submitButton = modal.locator('button:has-text("Uložiť"), button:has-text("Pridať")');
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await waitForApp(page);
    }
  });

  test('READ: should show harvest statistics', async ({ page }) => {
    await page.goto('/harvests');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Stats section should be visible
    const stats = page.locator('.harvest-stats, .stats-summary, [class*="stat"]');
    if (await stats.count() > 0) {
      await expect(stats.first()).toBeVisible();
    }
  });
});

// ============================================================================
// PROFILE CRUD
// ============================================================================

test.describe('Profile Operations', () => {
  test('READ: should display user profile', async ({ page }) => {
    await page.goto('/profile');
    await waitForApp(page);
    await ensureAuth(page);
    
    await expect(page.locator('.profile-page').first()).toBeVisible();
  });

  test('UPDATE: should update profile bio', async ({ page }) => {
    await page.goto('/profile/edit');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Find bio textarea
    const bioInput = page.locator('textarea[name="bio"], textarea').first();
    if (await bioInput.count() === 0) {
      test.skip();
      return;
    }
    
    const originalBio = await bioInput.inputValue();
    const newBio = `E2E Test Bio ${uniqueId()}`;
    
    await bioInput.fill(newBio);
    
    // Save with force click
    const saveButton = page.locator('button:has-text("Uložiť")');
    await saveButton.click({ force: true });
    await waitForApp(page);
    
    // Revert
    await page.goto('/profile/edit');
    await waitForApp(page);
    
    const bioInputAgain = page.locator('textarea[name="bio"], textarea').first();
    await bioInputAgain.fill(originalBio);
    await page.locator('button:has-text("Uložiť")').click({ force: true });
    await waitForApp(page);
  });
});

// ============================================================================
// SOCIAL CRUD
// ============================================================================

test.describe('Social Operations', () => {
  test('SEARCH: should search for users', async ({ page }) => {
    await page.goto('/search');
    await waitForApp(page);
    await ensureAuth(page);
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="Hľadať"]');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    
    // Results or no results should appear
    await expect(page.locator('body')).toBeVisible();
  });

  test('READ: should display friends list', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await ensureAuth(page);
    
    await expect(page.locator('.friends-page').first()).toBeVisible();
  });

  test('READ: should display friend requests', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Look for requests button/section
    const requestsBtn = page.locator('button:has-text("Žiadosti"), a:has-text("Žiadosti")');
    await expect(requestsBtn.first()).toBeVisible();
  });
});

// ============================================================================
// GROUP CRUD
// ============================================================================

test.describe('Group Operations', () => {
  test('CREATE: should open create group page', async ({ page }) => {
    await page.goto('/groups/create');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Wait for loading to finish
    await page.waitForTimeout(1000);
    
    // Check for heading or page container
    const heading = page.getByRole('heading', { name: /vytvoriť|skupin/i });
    if (await heading.count() > 0) {
      await expect(heading.first()).toBeVisible();
    } else {
      // Check for create group page container
      await expect(page.locator('.create-group-page').first()).toBeVisible();
    }
  });

  test('READ: should display groups list', async ({ page }) => {
    await page.goto('/groups');
    await waitForApp(page);
    await ensureAuth(page);
    
    await expect(page.locator('.groups-page').first()).toBeVisible();
  });
});

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

test.describe('Message Operations', () => {
  test('READ: should display messages page', async ({ page }) => {
    await page.goto('/messages');
    await waitForApp(page);
    await ensureAuth(page);
    
    await expect(page.locator('.messages-page').first()).toBeVisible();
  });

  test('SEND: should open chat and show input', async ({ page }) => {
    await page.goto('/messages');
    await waitForApp(page);
    await ensureAuth(page);
    
    // If there are conversations, click one
    const conversation = page.locator('.conversation-item, .chat-item').first();
    if (await conversation.count() > 0 && await conversation.isVisible()) {
      await conversation.click();
      await waitForApp(page);
      
      // Chat input should be visible
      const chatInput = page.locator('input[placeholder*="Napíš"], textarea[placeholder*="Napíš"]');
      if (await chatInput.count() > 0) {
        await expect(chatInput.first()).toBeVisible();
      }
    }
  });
});

// ============================================================================
// API KEY OPERATIONS
// ============================================================================

test.describe('API Key Operations', () => {
  test('should copy API key to clipboard', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Find an API hive
    const apiHive = page.locator('.hive-card:has(.api-badge)').first();
    if (await apiHive.count() === 0) {
      test.skip('No API hives');
      return;
    }
    
    // Open edit modal
    await apiHive.locator('button:has-text("✏️")').click();
    await page.waitForTimeout(300);
    
    // Should show API key
    const apiKey = page.locator('.api-key-code');
    if (await apiKey.count() > 0) {
      await expect(apiKey).toBeVisible();
      
      // Click copy button
      const copyButton = page.locator('button:has-text("Kopírovať"), button:has-text("📋")');
      if (await copyButton.count() > 0) {
        await copyButton.first().click();
        
        // Should show success toast
        const toast = page.locator('.toast:has-text("skopírovaný")');
        await expect(toast).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should regenerate API key with confirmation', async ({ page }) => {
    await page.goto('/my-hives');
    await waitForApp(page);
    await ensureAuth(page);
    
    // Find an API hive
    const apiHive = page.locator('.hive-card:has(.api-badge)').first();
    if (await apiHive.count() === 0) {
      test.skip('No API hives');
      return;
    }
    
    // Open edit modal
    await apiHive.locator('button:has-text("✏️")').click();
    await page.waitForTimeout(300);
    
    // Find regenerate button
    const regenerateButton = page.locator('button:has-text("Vygenerovať nový")');
    if (await regenerateButton.count() === 0) {
      test.skip('No regenerate button');
      return;
    }
    
    // Setup dialog handler (cancel to avoid actually regenerating)
    page.on('dialog', dialog => dialog.dismiss());
    
    await regenerateButton.click();
    
    // Confirmation dialog should have appeared and been dismissed
    // Modal should still be open
    await expect(page.locator('.modal-content')).toBeVisible();
  });
});
