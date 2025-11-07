import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
import { waitUntil } from '@vercel/functions'
import sensorRoutes from '../lib/routes/sensor.js'
import esp32Routes from '../lib/routes/esp32.js'
import testDataRoutes from '../lib/routes/testData.js'
import lorawanRoutes from '../lib/routes/lorawan.js'
import inspectionRoutes from '../lib/routes/inspection.js'
import notificationsRoutes from '../lib/routes/notifications.js'
import adminRoutes from '../lib/routes/admin.js'

const app = express()

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(limiter)

// MongoDB connection with Vercel optimization
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }

    cached.promise = mongoose.connect(process.env.MONGODB_URI || process.env.STORE_MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB connected')
      return mongoose
    }).catch((err) => {
      console.error('❌ MongoDB connection error:', err)
      cached.promise = null
      throw err
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

// Routes
app.use('/api/sensor', sensorRoutes)
app.use('/api/esp32', esp32Routes)
app.use('/api/test', testDataRoutes)
app.use('/api/lorawan', lorawanRoutes)
app.use('/api/inspection', inspectionRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: {
      hasMongoDB: !!(process.env.MONGODB_URI || process.env.STORE_MONGODB_URI),
      hasAPIKey: !!process.env.ESP32_API_KEY
    }
  })
})

// Error handling
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack)
  res.status(500).json({ error: 'Server error', message: err.message })
})

// Vercel serverless handler with connection pool management
export default async (req, res) => {
  try {
    await connectDB()
    
    // Use waitUntil to keep connection alive for next invocation
    waitUntil(
      new Promise(resolve => {
        setTimeout(resolve, 1000) // Keep connection warm
      })
    )
    
    return app(req, res)
  } catch (error) {
    console.error('Handler error:', error)
    return res.status(500).json({ 
      error: 'Database connection failed',
      message: error.message 
    })
  }
}
