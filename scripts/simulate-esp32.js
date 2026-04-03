/**
 * ESP32 Device Simulator
 * Simulates ESP32 sending sensor data via WiFi
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://ebeehive.vercel.app'
const HIVE_ID = process.env.HIVE_ID || 'HIVE-001'
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

// Send data via API endpoint
async function sendWiFiData(data) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/sensor`, {
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

// Main simulation loop
async function startSimulation() {
  console.log('🐝 ESP32 Device Simulator Started')
  console.log(`   Backend: ${BACKEND_URL}`)
  console.log(`   Hive ID: ${HIVE_ID}`)
  console.log(`   Interval: ${INTERVAL}ms (${INTERVAL/1000}s)`)
  console.log('   Press Ctrl+C to stop\n')
  
  // Send first reading immediately
  const data = generateSensorData()
  await sendWiFiData(data)
  
  // Then send at regular intervals
  setInterval(async () => {
    const data = generateSensorData()
    await sendWiFiData(data)
  }, INTERVAL)
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Simulator stopped')
  process.exit(0)
})

// Start simulation
startSimulation()
