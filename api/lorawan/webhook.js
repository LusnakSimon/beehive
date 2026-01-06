const { connectDB } = require('../../lib/utils/db.js');

module.exports = async (req, res) => {
  // Set CORS headers for webhook (allow from TTN/ChirpStack)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('X-Webhook-Version', '2025-01-15-v2');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    
    const User = require('../../lib/models/User');
    const Reading = require('../../lib/models/Reading');
    
    // Parse incoming webhook data from TTN/ChirpStack
    const { end_device_ids, uplink_message } = req.body;
    
    // Extract devEUI and data
    const devEUI = end_device_ids?.dev_eui?.toUpperCase();
    const payload = uplink_message?.decoded_payload || {};
    const metadata = {
      rssi: uplink_message?.rx_metadata?.[0]?.rssi,
      snr: uplink_message?.rx_metadata?.[0]?.snr,
      timestamp: uplink_message?.received_at || new Date().toISOString()
    };
    
    // ...existing code...
    
    if (!devEUI) {
      console.warn('[LoRaWAN Webhook] Missing devEUI in request');
      return res.status(400).json({ error: 'Missing devEUI' });
    }
    
    // Find user with this devEUI
    const user = await User.findOne({ 
      'ownedHives.device.devEUI': devEUI 
    });
    
    if (!user) {
      console.warn('[LoRaWAN Webhook] Unknown devEUI:', devEUI);
      // Still return 200 to prevent TTN from retrying
      return res.status(200).json({ 
        success: false,
        message: 'Device not registered',
        devEUI 
      });
    }
    
    // Find which hive has this devEUI
    const hive = user.ownedHives.find(h => 
      h.device?.devEUI === devEUI
    );
    
    if (!hive) {
      console.warn('[LoRaWAN Webhook] DevEUI found but hive not matched:', devEUI);
      return res.status(200).json({ 
        success: false,
        message: 'Device found but not matched to hive' 
      });
    }
    
    // ...existing code...
    
    // Create reading from payload
    const readingData = {
      hiveId: hive.id,
      temperature: payload.temperature,
      humidity: payload.humidity,
      weight: payload.weight,
      batteryLevel: payload.battery,
      signalStrength: metadata.rssi,
      source: 'LoRaWAN',
      timestamp: new Date(metadata.timestamp),
      metadata: {
        devEUI,
        rssi: metadata.rssi,
        snr: metadata.snr,
        rawPayload: payload
      }
    };
    
    // Remove undefined fields
    Object.keys(readingData).forEach(key => {
      if (readingData[key] === undefined) {
        delete readingData[key];
      }
    });
    
    // Save reading
    const reading = await Reading.create(readingData);
    // ...existing code...
    
    // Update hive device status
    if (hive.device) {
      hive.device.lastSeen = new Date();
      hive.device.signalStrength = metadata.rssi;
      hive.device.batteryLevel = payload.battery;
      await user.save();
    }
    
    // TODO: Check alert conditions
    // checkAlertConditions(hive, payload);
    
    res.status(200).json({ 
      success: true,
      hiveId: hive.id,
      hiveName: hive.name,
      readingId: reading._id,
      message: 'Data received and saved'
    });
    
  } catch (error) {
    console.error('[LoRaWAN Webhook] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
