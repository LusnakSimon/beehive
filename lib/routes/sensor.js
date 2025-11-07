import express from 'express'
import Reading from '../models/Reading.js'

const router = express.Router()

// GET /api/sensor/latest?hiveId=HIVE-001 - Posledné meranie
router.get('/latest', async (req, res) => {
  try {
    const hiveId = req.query.hiveId || 'HIVE-001'
    
    const latest = await Reading.findOne({ hiveId }).sort({ timestamp: -1 })
    
    if (!latest) {
      return res.json({
        temperature: 0,
        humidity: 0,
        weight: 0,
        battery: 0,
        lastUpdate: null,
        metadata: null
      })
    }

    res.json({
      temperature: latest.temperature,
      humidity: latest.humidity,
      weight: latest.weight,
      battery: latest.battery,
      lastUpdate: latest.timestamp,
      metadata: latest.metadata || null
    })
  } catch (error) {
    console.error('Chyba pri načítaní dát:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

// GET /api/sensor/history?range=6h|24h|7d|30d|90d|180d|365d&hiveId=HIVE-001 - História meraní
router.get('/history', async (req, res) => {
  try {
    const range = req.query.range || '24h'
    const hiveId = req.query.hiveId || 'HIVE-001'
    const now = new Date()
    let startDate

    switch (range) {
      case '6h':
        startDate = new Date(now - 6 * 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now - 90 * 24 * 60 * 60 * 1000)
        break
      case '180d':
        startDate = new Date(now - 180 * 24 * 60 * 60 * 1000)
        break
      case '365d':
        startDate = new Date(now - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now - 24 * 60 * 60 * 1000)
    }

    const readings = await Reading.find({
      hiveId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 }).select('-__v')

    res.json(readings)
  } catch (error) {
    console.error('Chyba pri načítaní histórie:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

// GET /api/sensor/stats?range=...&hiveId=HIVE-001 - Štatistiky pre dané obdobie
router.get('/stats', async (req, res) => {
  try {
    const range = req.query.range || '24h'
    const hiveId = req.query.hiveId || 'HIVE-001'
    const now = new Date()
    let startDate

    switch (range) {
      case '6h':
        startDate = new Date(now - 6 * 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now - 90 * 24 * 60 * 60 * 1000)
        break
      case '180d':
        startDate = new Date(now - 180 * 24 * 60 * 60 * 1000)
        break
      case '365d':
        startDate = new Date(now - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now - 24 * 60 * 60 * 1000)
    }
    
    const stats = await Reading.aggregate([
      { $match: { hiveId, timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          temperature: {
            avg: { $avg: '$temperature' },
            min: { $min: '$temperature' },
            max: { $max: '$temperature' }
          },
          humidity: {
            avg: { $avg: '$humidity' },
            min: { $min: '$humidity' },
            max: { $max: '$humidity' }
          },
          weight: {
            avg: { $avg: '$weight' },
            min: { $min: '$weight' },
            max: { $max: '$weight' }
          },
          battery: {
            avg: { $avg: '$battery' },
            min: { $min: '$battery' }
          },
          count: { $sum: 1 }
        }
      }
    ])

    if (stats.length === 0) {
      return res.json({
        temperature: { avg: 0, min: 0, max: 0 },
        humidity: { avg: 0, min: 0, max: 0 },
        weight: { avg: 0, min: 0, max: 0 },
        battery: { avg: 0, min: 0 },
        count: 0
      })
    }

    // Restructure output
    const result = stats[0]
    res.json({
      temperature: result.temperature,
      humidity: result.humidity,
      weight: result.weight,
      battery: result.battery,
      count: result.count,
      range,
      startDate
    })
  } catch (error) {
    console.error('Chyba pri výpočte štatistík:', error)
    res.status(500).json({ error: 'Chyba servera' })
  }
})

export default router
