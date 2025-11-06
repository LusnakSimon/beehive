import express from 'express'
import Reading from '../models/Reading.js'

const router = express.Router()

/**
 * DELETE /api/admin/readings?hiveId=HIVE-001&olderThan=2024-11-06
 * Clear old readings for a specific hive
 */
router.delete('/readings', async (req, res) => {
  try {
    const { hiveId, olderThan, all } = req.query
    
    let filter = {}
    
    if (all === 'true') {
      // Delete ALL readings (use with caution!)
      filter = {}
    } else if (hiveId && olderThan) {
      // Delete specific hive older than date
      filter = {
        hiveId,
        timestamp: { $lt: new Date(olderThan) }
      }
    } else if (hiveId) {
      // Delete ALL readings for specific hive
      filter = { hiveId }
    } else if (olderThan) {
      // Delete ALL readings older than date
      filter = {
        timestamp: { $lt: new Date(olderThan) }
      }
    } else {
      return res.status(400).json({ 
        error: 'Provide at least one parameter: hiveId, olderThan, or all=true' 
      })
    }
    
    const result = await Reading.deleteMany(filter)
    
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} readings`,
      deletedCount: result.deletedCount,
      filter
    })
  } catch (error) {
    console.error('Error deleting readings:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/admin/stats
 * Get database statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const totalReadings = await Reading.countDocuments()
    const hives = await Reading.distinct('hiveId')
    
    const hiveStats = await Promise.all(
      hives.map(async (hiveId) => {
        const count = await Reading.countDocuments({ hiveId })
        const latest = await Reading.findOne({ hiveId }).sort({ timestamp: -1 })
        const oldest = await Reading.findOne({ hiveId }).sort({ timestamp: 1 })
        
        return {
          hiveId,
          count,
          latestReading: latest?.timestamp,
          oldestReading: oldest?.timestamp
        }
      })
    )
    
    res.json({
      totalReadings,
      totalHives: hives.length,
      hives: hiveStats
    })
  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
