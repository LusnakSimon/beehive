/**
 * Manual Login Helper for E2E Tests
 * 
 * Run this script to open a browser, log in manually, and save your session.
 * The session will be reused by all E2E tests.
 * 
 * Usage: node e2e/login-helper.js
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

async function manualLogin() {
  console.log('\n🐝 eBeeHive E2E Login Helper\n');
  console.log('Opening browser for manual login...');
  console.log('Please log in with Google or GitHub.\n');
  
  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  
  // Launch browser in headed mode (visible)
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slight delay so you can see what's happening
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Go to login page
  const baseUrl = process.env.E2E_BASE_URL || 'https://ebeehive.vercel.app';
  await page.goto(`${baseUrl}/login`);
  
  console.log('📝 Instructions:');
  console.log('   1. Click "Pokračovať s Google" or "Pokračovať s GitHub"');
  console.log('   2. Complete the OAuth login');
  console.log('   3. Wait until you see the Dashboard');
  console.log('   4. The browser will close automatically\n');
  
  // Wait for successful login (user lands on dashboard, not login page)
  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { 
      timeout: 120000 // 2 minutes for manual login
    });
    
    console.log('✅ Login successful! Saving session...\n');
    
    // Save the authentication state
    await context.storageState({ path: authFile });
    
    console.log(`💾 Session saved to: ${authFile}`);
    console.log('\n🎉 You can now run E2E tests with authentication:');
    console.log('   npx playwright test\n');
    
  } catch (error) {
    console.log('❌ Login timed out or failed.');
    console.log('   Please try again.\n');
  }
  
  await browser.close();
}

// Run the helper
manualLogin().catch(console.error);
