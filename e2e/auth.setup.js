import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Playwright Authentication Setup
 * 
 * This file handles authentication for E2E tests.
 * Since the app uses OAuth (Google/GitHub), we can't automate the full login flow.
 * 
 * Options for authenticated testing:
 * 
 * 1. MANUAL SETUP (Recommended for local dev):
 *    - Run: npx playwright test --ui
 *    - Manually log in once
 *    - Storage state is saved for subsequent tests
 * 
 * 2. TEST USER (For CI):
 *    - Create a test user in your database
 *    - Set environment variables with session token
 *    - This setup will inject the auth cookies
 * 
 * 3. MOCK AUTH (For unit-style E2E):
 *    - Mock the /api/session endpoint
 *    - Skip auth checks in test environment
 */

setup('authenticate', async ({ page, context }) => {
  // Option 1: Check if we have existing auth from environment
  const testToken = process.env.E2E_TEST_TOKEN;
  
  if (testToken) {
    // Inject auth cookie from environment variable
    await context.addCookies([{
      name: 'auth-token',
      value: testToken,
      domain: new URL(process.env.E2E_BASE_URL || 'https://ebeehive.vercel.app').hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }]);
    
    // Verify auth works
    await page.goto('/');
    const isLoggedIn = !page.url().includes('/login');
    
    if (isLoggedIn) {
      await context.storageState({ path: authFile });
      return;
    }
  }
  
  // Option 2: Manual authentication (interactive mode)
  // When running locally, this allows you to log in manually
  if (!process.env.CI) {
    console.log('\n📝 No auth token found. For authenticated tests:');
    console.log('1. Run: npx playwright test --ui');
    console.log('2. Log in manually when the browser opens');
    console.log('3. Tests will use the saved session\n');
    
    // Try to load existing auth state
    try {
      const fs = await import('fs');
      if (fs.existsSync(authFile)) {
        console.log('✅ Found existing auth state, using it...');
        return;
      }
    } catch (e) {
      // No existing auth
    }
    
    // In interactive mode, open login page for manual login
    await page.goto('/login');
    
    // Wait for user to log in (with long timeout for manual action)
    await page.waitForURL(url => !url.toString().includes('/login'), { 
      timeout: 120000 // 2 minutes for manual login
    }).catch(() => {
      console.log('⚠️ Login timeout - running tests without authentication');
    });
    
    // If logged in, save state
    if (!page.url().includes('/login')) {
      await context.storageState({ path: authFile });
      console.log('✅ Auth state saved!');
    }
  }
  
  // Option 3: CI without auth - skip authenticated tests
  if (process.env.CI && !testToken) {
    console.log('⚠️ Running in CI without auth - authenticated tests will be skipped');
  }
});

/**
 * Helper to create a test user session (for CI setup scripts)
 * 
 * Usage in CI:
 *   node -e "require('./e2e/auth.setup.js').createTestSession()"
 */
export async function createTestSession() {
  // This would create a test user and return a session token
  // Implement based on your auth system
  console.log(`
To set up E2E testing with authentication:

1. Create a test user in your database
2. Generate a JWT token for that user
3. Set E2E_TEST_TOKEN environment variable
4. Run tests: E2E_TEST_TOKEN=<token> npx playwright test

Example token generation (in Node.js):
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: 'test-user-id', email: 'test@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  console.log(token);
`);
}
