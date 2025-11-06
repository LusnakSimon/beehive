/**
 * ESP32 Device Simulator
 * Simulates ESP32 sending sensor data via WiFi or LoRaWAN
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://ebeehive.vercel.app'
const HIVE_ID = process.env.HIVE_ID || 'HIVE-001'
const MODE = process.env.MODE || 'wifi' // wifi or lorawan
const INTERVAL = parseInt(process.env.INTERVAL || '30000') // 30 seconds default

// Simulate sensor readings with realistic variations
function generateSensorData() {
  const hour = new Date().getHours()
  
  // Temperature: 30-36°C with daily cycle
  const baseTemp = 33
  const tempVariation = Math.sin(hour / 24 * Math.PI * 2) * 2
  const tempNoise = (Math.random() - 0.5) * 1.5
  const temperature = parseFloat((baseTemp + tempVariation + tempNoise).toFixed(1))
  
  // Humidity: 40-70% with inverse daily cycle
  const baseHumidity = 55
  const humidityVariation = Math.sin((hour + 6) / 24 * Math.PI * 2) * 8
  const humidityNoise = (Math.random() - 0.5) * 5
  const humidity = parseFloat(Math.max(40, Math.min(70, baseHumidity + humidityVariation + humidityNoise)).toFixed(1))
  
  // Weight: slowly increasing (honey production)
  const baseWeight = 45
  const weightNoise = (Math.random() - 0.5) * 0.5
  const weight = parseFloat((baseWeight + weightNoise).toFixed(2))
  
  // Battery: slowly decreasing
  const battery = Math.floor(Math.random() * 20) + 70 // 70-90%
  
  return { temperature, humidity, weight, battery }
}

// Send data via WiFi endpoint
async function sendWiFiData(data) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/esp32/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        hiveId: HIVE_ID
      })
    })
    
    const result = await response.json()
    console.log(`✅ WiFi: Data sent successfully`)
    console.log(`   📊 Temp: ${data.temperature}°C, Humidity: ${data.humidity}%, Weight: ${data.weight}kg, Battery: ${data.battery}%`)
    return result
  } catch (error) {
    console.error('❌ WiFi: Error sending data:', error.message)
  }
}

// Simulate LoRaWAN uplink (encode to binary payload)
function encodeLoRaWANPayload(data) {
  // Same encoding as ESP32: temp(2), hum(2), weight(4), battery(1) = 9 bytes
  const buffer = Buffer.alloc(9)
  buffer.writeInt16BE(Math.round(data.temperature * 10), 0)
  buffer.writeInt16BE(Math.round(data.humidity * 10), 2)
  buffer.writeInt32BE(Math.round(data.weight * 100), 4)
  buffer.writeUInt8(data.battery, 8)
  return buffer.toString('base64')
}

// Send data via LoRaWAN webhook (simulate TTN uplink)
async function sendLoRaWANData(data) {
  try {
    const payload = encodeLoRaWANPayload(data)
    
    // Simulate TTN v3 uplink message format
    const ttnMessage = {
      end_device_ids: {
        device_id: `beehive-${HIVE_ID.toLowerCase()}`,
        dev_eui: '0000000000000001'
      },
      uplink_message: {
        frm_payload: payload,
        rx_metadata: [
          {
            gateway_ids: {
              gateway_id: 'test-gateway-001'
            },
            rssi: -Math.floor(Math.random() * 40) - 80, // -80 to -120
            snr: Math.floor(Math.random() * 10) - 5, // -5 to 5
            timestamp: Date.now()
          }
        ],
        settings: {
          data_rate: {
            lora: {
              spreading_factor: 7
            }
          }
        }
      },
      received_at: new Date().toISOString()
    }
    
    const response = await fetch(`${BACKEND_URL}/api/lorawan/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ttnMessage)
    })
    
    const result = await response.json()
    console.log(`✅ LoRaWAN: Data sent successfully`)
    console.log(`   📊 Temp: ${data.temperature}°C, Humidity: ${data.humidity}%, Weight: ${data.weight}kg, Battery: ${data.battery}%`)
    console.log(`   📡 Payload: ${payload}`)
    return result
  } catch (error) {
    console.error('❌ LoRaWAN: Error sending data:', error.message)
  }
}

// Main simulation loop
async function startSimulation() {
  console.log('🐝 ESP32 Device Simulator Started')
  console.log(`   Backend: ${BACKEND_URL}`)
  console.log(`   Hive ID: ${HIVE_ID}`)
  console.log(`   Mode: ${MODE.toUpperCase()}`)
  console.log(`   Interval: ${INTERVAL}ms (${INTERVAL/1000}s)`)
  console.log('   Press Ctrl+C to stop\n')
  
  // Send first reading immediately
  const data = generateSensorData()
  if (MODE === 'lorawan') {
    await sendLoRaWANData(data)
  } else {
    await sendWiFiData(data)
  }
  
  // Then send at regular intervals
  setInterval(async () => {
    const data = generateSensorData()
    if (MODE === 'lorawan') {
      await sendLoRaWANData(data)
    } else {
      await sendWiFiData(data)
    }
  }, INTERVAL)
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Simulator stopped')
  process.exit(0)
})

// Start simulation
startSimulation()
