import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
import sensorRoutes from '../routes/sensor.js'
import esp32Routes from '../routes/esp32.js'

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

// MongoDB connection
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
    }

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      return mongoose
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

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Niečo sa pokazilo!' })
})

// Vercel serverless handler
export default async (req, res) => {
  await connectDB()
  return app(req, res)
}
