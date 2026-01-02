/**
 * LoRaWAN End-to-End Test Script
 * 
 * This script tests the complete LoRaWAN flow:
 * 1. Adds a devEUI to an existing user's hive
 * 2. Sends a test payload to the webhook
 * 3. Verifies the reading was saved
 * 
 * Usage: node scripts/test-lorawan-e2e.js
 * 
 * Requires: MONGODB_URI environment variable
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const TEST_DEV_EUI = '70B3D57ED005E2E1';

async function runTest() {
  console.log('🧪 LoRaWAN E2E Test\n');
  
  // Connect to database
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not set. Create .env.local with your MongoDB URI');
    process.exit(1);
  }
  
  console.log('📡 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected\n');
  
  // Get models
  const User = require('../lib/models/User');
  const Reading = require('../lib/models/Reading');
  
  try {
    // Step 1: Find a user with hives
    console.log('👤 Finding a user with hives...');
    const user = await User.findOne({ 
      'ownedHives.0': { $exists: true } 
    });
    
    if (!user) {
      console.log('❌ No users with hives found. Create a user first via the app.');
      return;
    }
    
    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   Hives: ${user.ownedHives.length}`);
    
    // Step 2: Add devEUI to first hive
    const hive = user.ownedHives[0];
    const hiveId = typeof hive === 'string' ? hive : hive.id;
    const hiveName = typeof hive === 'string' ? hive : hive.name;
    
    console.log(`\n📦 Adding devEUI to hive: ${hiveName} (${hiveId})`);
    
    // Update hive with devEUI
    if (typeof hive === 'object') {
      hive.device = hive.device || {};
      hive.device.type = 'api';
      hive.device.devEUI = TEST_DEV_EUI;
      // Mark as modified since ownedHives is a Mixed type
      user.markModified('ownedHives');
    } else {
      // Old string format - convert to object
      user.ownedHives[0] = {
        id: hive,
        name: `Úľ ${hive.replace('HIVE-', '')}`,
        device: {
          type: 'api',
          devEUI: TEST_DEV_EUI
        }
      };
    }
    
    await user.save();
    console.log(`✅ DevEUI ${TEST_DEV_EUI} added to hive\n`);
    
    // Step 3: Delete any existing test readings
    console.log('🧹 Cleaning up old test readings...');
    await Reading.deleteMany({ 
      'metadata.devEUI': TEST_DEV_EUI 
    });
    
    // Step 4: Send test data via webhook
    console.log('📤 Sending test data to webhook...');
    const https = require('https');
    
    const testPayload = {
      end_device_ids: {
        dev_eui: TEST_DEV_EUI,
        device_id: 'test-beehive-device'
      },
      uplink_message: {
        decoded_payload: {
          temperature: 35.2,
          humidity: 58.5,
          weight: 42.75,
          battery: 92
        },
        rx_metadata: [{
          rssi: -87,
          snr: 8.2
        }],
        received_at: new Date().toISOString()
      }
    };
    
    const webhookResult = await new Promise((resolve, reject) => {
      const data = JSON.stringify(testPayload);
      const req = https.request({
        hostname: 'ebeehive.vercel.app',
        path: '/api/lorawan/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    
    console.log(`   Status: ${webhookResult.status}`);
    console.log(`   Response:`, webhookResult.body);
    
    if (!webhookResult.body.success) {
      console.log('\n❌ Webhook failed:', webhookResult.body.message);
      return;
    }
    
    console.log('\n✅ Webhook accepted data!\n');
    
    // Step 5: Verify reading was saved
    console.log('🔍 Verifying reading in database...');
    
    // Wait a moment for the write to complete
    await new Promise(r => setTimeout(r, 1000));
    
    const reading = await Reading.findOne({ 
      'metadata.devEUI': TEST_DEV_EUI 
    }).sort({ timestamp: -1 });
    
    if (!reading) {
      console.log('❌ Reading not found in database!');
      return;
    }
    
    console.log('✅ Reading saved successfully!');
    console.log(`   ID: ${reading._id}`);
    console.log(`   Hive: ${reading.hiveId}`);
    console.log(`   Temperature: ${reading.temperature}°C`);
    console.log(`   Humidity: ${reading.humidity}%`);
    console.log(`   Weight: ${reading.weight}kg`);
    console.log(`   Battery: ${reading.batteryLevel}%`);
    console.log(`   Source: ${reading.source}`);
    console.log(`   Timestamp: ${reading.timestamp}`);
    
    console.log('\n🎉 E2E Test PASSED!\n');
    console.log('The LoRaWAN integration is working correctly.');
    console.log(`Data from device ${TEST_DEV_EUI} → Hive ${reading.hiveId} → Dashboard`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup: Remove test devEUI
    console.log('\n🧹 Cleaning up test data...');
    try {
      await User.updateMany(
        { 'ownedHives.device.devEUI': TEST_DEV_EUI },
        { $unset: { 'ownedHives.$.device.devEUI': '' } }
      );
      await Reading.deleteMany({ 'metadata.devEUI': TEST_DEV_EUI });
    } catch (e) {
      // Ignore cleanup errors
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

runTest();
