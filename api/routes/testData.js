import express from 'express'
import Reading from '../models/Reading.js'

const router = express.Router()

// Generate test data
router.post('/generate', async (req, res) => {
  try {
    const { days = 7, pointsPerDay = 24 } = req.body
    
    // Clear existing test data
    await Reading.deleteMany({})
    
    const readings = []
    const now = new Date()
    
    // Generate data for the specified number of days
    for (let day = days - 1; day >= 0; day--) {
      for (let hour = 0; hour < pointsPerDay; hour++) {
        const timestamp = new Date(now)
        timestamp.setDate(now.getDate() - day)
        timestamp.setHours(hour)
        timestamp.setMinutes(Math.floor(Math.random() * 60))
        timestamp.setSeconds(0)
        
        // Generate realistic beehive data with variations
        const baseTemp = 33 // Base temperature around 33°C
        const tempVariation = Math.sin(hour / 24 * Math.PI * 2) * 2 // Daily cycle
        const tempNoise = (Math.random() - 0.5) * 1.5
        const temperature = baseTemp + tempVariation + tempNoise
        
        const baseHumidity = 55 // Base humidity around 55%
        const humidityVariation = Math.sin((hour + 6) / 24 * Math.PI * 2) * 8
        const humidityNoise = (Math.random() - 0.5) * 5
        const humidity = Math.max(40, Math.min(70, baseHumidity + humidityVariation + humidityNoise))
        
        // Weight gradually increases (honey production)
        const baseWeight = 45
        const weightGrowth = (days - day) * 0.3 // Gradual increase
        const weightNoise = (Math.random() - 0.5) * 0.5
        const weight = baseWeight + weightGrowth + weightNoise
        
        // Battery slowly decreases
        const battery = Math.max(15, 100 - (day * 2) - Math.floor(Math.random() * 5))
        
        readings.push({
          temperature: parseFloat(temperature.toFixed(1)),
          humidity: parseFloat(humidity.toFixed(1)),
          weight: parseFloat(weight.toFixed(2)),
          battery: battery,
          hiveId: 'test-hive-001',
          timestamp: timestamp
        })
      }
    }
    
    // Insert all readings
    await Reading.insertMany(readings)
    
    res.json({
      success: true,
      message: `Generated ${readings.length} test readings`,
      count: readings.length,
      dateRange: {
        from: readings[0].timestamp,
        to: readings[readings.length - 1].timestamp
      }
    })
  } catch (error) {
    console.error('Error generating test data:', error)
    res.status(500).json({ error: error.message })
  }
})

// Clear all test data
router.delete('/clear', async (req, res) => {
  try {
    const result = await Reading.deleteMany({})
    res.json({
      success: true,
      message: 'All test data cleared',
      deletedCount: result.deletedCount
    })
  } catch (error) {
    console.error('Error clearing test data:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
