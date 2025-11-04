import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
import sensorRoutes from './routes/sensor.js'
import esp32Routes from './routes/esp32.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minút
  max: 100 // max 100 requestov per window
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(limiter)

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/beehive-monitor')
    console.log('✅ MongoDB pripojená')
  } catch (error) {
    console.error('❌ MongoDB chyba:', error)
    process.exit(1)
  }
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

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server beží na porte ${PORT}`)
  })
})

export default app
