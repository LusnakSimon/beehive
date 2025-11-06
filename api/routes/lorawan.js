import express from 'express'
import Reading from '../models/Reading.js'

const router = express.Router()

// TTN Webhook Endpoint
router.post('/webhook', async (req, res) => {
  try {
    console.log('LoRaWAN uplink received:', JSON.stringify(req.body, null, 2))
    
    const { uplink_message, end_device_ids } = req.body
    
    if (!uplink_message) {
      console.log('No uplink_message found')
      return res.status(400).json({ error: 'Invalid payload format' })
    }
    
    let data
    
    // Check if payload is already decoded (from TTN payload formatter)
    if (uplink_message.decoded_payload) {
      data = uplink_message.decoded_payload
    } 
    // Otherwise decode from frm_payload (base64 binary)
    else if (uplink_message.frm_payload) {
      const payload = Buffer.from(uplink_message.frm_payload, 'base64')
      
      if (payload.length < 9) {
        console.log('Payload too short:', payload.length)
        return res.status(400).json({ error: 'Invalid payload length' })
      }
      
      // Decode: temp(2), hum(2), weight(4), battery(1) = 9 bytes
      data = {
        temperature: payload.readInt16BE(0) / 10.0,
        humidity: payload.readInt16BE(2) / 10.0,
        weight: payload.readInt32BE(4) / 100.0,
        battery: payload.readUInt8(8)
      }
      
      console.log('Decoded payload:', data)
    } else {
      console.log('No payload found')
      return res.status(400).json({ error: 'Missing payload' })
    }
    
    // Validate required fields
    if (data.temperature === undefined || data.humidity === undefined ||
        data.weight === undefined || data.battery === undefined) {
      console.log('Missing required fields in decoded payload')
      return res.status(400).json({ error: 'Missing sensor data' })
    }
    
    // Extract hiveId from device_id (e.g., "beehive-hive-001" -> "HIVE-001")
    const deviceId = end_device_ids?.device_id || 'unknown'
    let hiveId = 'HIVE-001' // default
    
    if (deviceId.includes('hive-')) {
      const parts = deviceId.split('hive-')
      if (parts[1]) {
        hiveId = 'HIVE-' + parts[1].toUpperCase().replace(/^0+/, '')
      }
    }
    
    console.log(`Extracted hiveId: ${hiveId} from device_id: ${deviceId}`)    // Extract metadata
    const metadata = {
      deviceId: end_device_ids?.device_id || 'unknown',
      devEui: end_device_ids?.dev_eui || null,
      rssi: uplink_message.rx_metadata?.[0]?.rssi || null,
      snr: uplink_message.rx_metadata?.[0]?.snr || null,
      gatewayId: uplink_message.rx_metadata?.[0]?.gateway_ids?.gateway_id || null,
      spreadingFactor: uplink_message.settings?.data_rate?.lora?.spreading_factor || null,
      frequency: uplink_message.settings?.frequency || null
    }
    
    // Create reading
    const reading = new Reading({
      hiveId,
      temperature: data.temperature,
      humidity: data.humidity,
      weight: data.weight,
      battery: data.battery,
      timestamp: new Date(uplink_message.received_at || Date.now()),
      metadata: {
        source: 'lorawan',
        ...metadata
      }
    })
    
    await reading.save()
    
    console.log(`Saved LoRaWAN reading: T=${data.temperature}°C H=${data.humidity}% W=${data.weight}kg B=${data.battery}%`)
    console.log(`RSSI: ${metadata.rssi} dBm, SNR: ${metadata.snr} dB`)
    
    res.status(200).json({ 
      success: true,
      message: 'Data received and stored',
      reading: {
        temperature: reading.temperature,
        humidity: reading.humidity,
        weight: reading.weight,
        battery: reading.battery,
        timestamp: reading.timestamp
      }
    })
  } catch (error) {
    console.error('Error processing LoRaWAN webhook:', error)
    res.status(500).json({ 
      error: 'Failed to process webhook',
      message: error.message 
    })
  }
})

// Get LoRaWAN devices statistics
router.get('/devices', async (req, res) => {
  try {
    const devices = await Reading.aggregate([
      { $match: { 'metadata.source': 'lorawan' } },
      { 
        $group: {
          _id: '$metadata.deviceId',
          lastSeen: { $max: '$timestamp' },
          totalMessages: { $sum: 1 },
          avgRssi: { $avg: '$metadata.rssi' },
          avgSnr: { $avg: '$metadata.snr' },
          minBattery: { $min: '$battery' },
          latestBattery: { $last: '$battery' }
        }
      },
      { $sort: { lastSeen: -1 } }
    ])
    
    res.json({
      count: devices.length,
      devices
    })
  } catch (error) {
    console.error('Error fetching LoRaWAN devices:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
