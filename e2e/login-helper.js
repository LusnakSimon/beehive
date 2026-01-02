/**
 * Manual Login Helper for E2E Tests
 * 
 * Opens Edge browser for manual OAuth login.
 * Uses readline to wait for user confirmation.
 * 
 * Usage: node e2e/login-helper.js
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

function waitForEnter(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function manualLogin() {
  console.log('\n🐝 eBeeHive E2E Login Helper\n');
  
  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  
  console.log('Launching Microsoft Edge...\n');
  
  // Launch Edge
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'msedge'
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Go to login page
  const baseUrl = process.env.E2E_BASE_URL || 'https://ebeehive.vercel.app';
  await page.goto(`${baseUrl}/login`);
  
  console.log('════════════════════════════════════════════════════');
  console.log('');
  console.log('  📝 INSTRUCTIONS:');
  console.log('');
  console.log('  1. In the Edge browser that just opened:');
  console.log('     → Click "Pokračovať s GitHub" (GitHub works better)');
  console.log('     → Or try Google if you prefer');
  console.log('     → Complete the login');
  console.log('');
  console.log('  2. Wait until you see the Dashboard');
  console.log('');
  console.log('  3. Come back here and press ENTER');
  console.log('');
  console.log('  ⚠️  DO NOT close the browser manually!');
  console.log('');
  console.log('════════════════════════════════════════════════════');
  console.log('');
  
  await waitForEnter('Press ENTER when you are logged in and see the Dashboard... ');
  
  console.log('\n💾 Saving session...');
  
  try {
    // Save the authentication state
    await context.storageState({ path: authFile });
    
    console.log(`✅ Session saved to: ${authFile}`);
    console.log('\n🎉 Success! You can now run E2E tests:');
    console.log('   npx playwright test\n');
  } catch (error) {
    console.log('❌ Failed to save session:', error.message);
  }
  
  await browser.close();
}

manualLogin().catch(console.error);
