import express from 'express'
import Reading from '../models/Reading.js'

const router = express.Router()

// Jednoduchá autentifikácia pre ESP32
const ESP32_API_KEY = process.env.ESP32_API_KEY || 'beehive-secret-key-2024'

const authenticateESP32 = (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  
  if (apiKey !== ESP32_API_KEY) {
    return res.status(401).json({ error: 'Neplatný API kľúč' })
  }
  
  next()
}

// POST /api/esp32/data - Prijímanie dát z ESP32
router.post('/data', authenticateESP32, async (req, res) => {
  try {
    const { temperature, humidity, weight, battery, hiveId } = req.body

    // Validácia
    if (temperature === undefined || humidity === undefined || weight === undefined) {
      return res.status(400).json({ 
        error: 'Chýbajúce povinné polia: temperature, humidity, weight' 
      })
    }

    // Vytvorenie nového záznamu
    const reading = new Reading({
      temperature: parseFloat(temperature),
      humidity: parseFloat(humidity),
      weight: parseFloat(weight),
      battery: battery !== undefined ? parseInt(battery) : 100,
      hiveId: hiveId || 'HIVE-001',
      timestamp: new Date()
    })

    await reading.save()

    console.log(`📊 Nové dáta z ESP32: T=${temperature}°C, H=${humidity}%, W=${weight}kg`)

    res.status(201).json({
      success: true,
      message: 'Dáta úspešne uložené',
      id: reading._id
    })
  } catch (error) {
    console.error('Chyba pri ukladaní dát z ESP32:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

// GET /api/esp32/test - Test endpoint pre ESP32
router.get('/test', authenticateESP32, (req, res) => {
  res.json({
    success: true,
    message: 'ESP32 pripojenie funguje!',
    timestamp: new Date().toISOString()
  })
})

export default router
