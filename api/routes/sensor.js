import express from 'express'
import Reading from '../models/Reading.js'

const router = express.Router()

// GET /api/sensor/latest - Posledné meranie
router.get('/latest', async (req, res) => {
  try {
    const latest = await Reading.findOne().sort({ timestamp: -1 })
    
    if (!latest) {
      return res.json({
        temperature: 0,
        humidity: 0,
        weight: 0,
        battery: 0,
        lastUpdate: null
      })
    }

    res.json({
      temperature: latest.temperature,
      humidity: latest.humidity,
      weight: latest.weight,
      battery: latest.battery,
      lastUpdate: latest.timestamp
    })
  } catch (error) {
    console.error('Chyba pri načítaní dát:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

// GET /api/sensor/history?range=24h|7d|30d - História meraní
router.get('/history', async (req, res) => {
  try {
    const range = req.query.range || '24h'
    const now = new Date()
    let startDate

    switch (range) {
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now - 24 * 60 * 60 * 1000)
    }

    const readings = await Reading.find({
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 }).select('-__v')

    res.json(readings)
  } catch (error) {
    console.error('Chyba pri načítaní histórie:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

// GET /api/sensor/stats - Štatistiky
router.get('/stats', async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const stats = await Reading.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$temperature' },
          minTemp: { $min: '$temperature' },
          maxTemp: { $max: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          avgWeight: { $avg: '$weight' },
          count: { $sum: 1 }
        }
      }
    ])

    res.json(stats[0] || {})
  } catch (error) {
    console.error('Chyba pri výpočte štatistík:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

export default router
