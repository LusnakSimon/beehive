const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

/**
 * POST /api/notifications/check?hiveId=HIVE-001
 * Check if current conditions meet alert criteria
 * Body: { enabled: true, temperature: true, humidity: true, battery: true, weight: true, offline: true }
 */
router.post('/check', async (req, res) => {
  try {
    const { hiveId } = req.query;
    const settings = req.body;

    if (!hiveId) {
      return res.status(400).json({ error: 'hiveId is required' });
    }

    if (!settings.enabled) {
      return res.json({ alerts: [], latest: null });
    }

    // Get latest reading
    const latest = await Reading.findOne({ hiveId }).sort({ timestamp: -1 });
    
    if (!latest) {
      return res.json({ alerts: [], latest: null });
    }

    const alerts = [];
    const now = new Date();

    // 1. OFFLINE CHECK (>60 minutes)
    if (settings.offline) {
      const readingAge = (now - new Date(latest.timestamp)) / (1000 * 60); // minutes
      if (readingAge > 60) {
        alerts.push({
          title: `⚠️ ${hiveId} - Zariadenie offline`,
          body: `Žiadne dáta už ${Math.round(readingAge)} minút`,
          tag: 'offline',
          data: { url: '/', hiveId, type: 'offline' }
        });
      }
    }

    // 2. TEMPERATURE CHECK
    if (settings.temperature) {
      // Get temperature range from localStorage (default: 30-36°C)
      const tempMin = 30;
      const tempMax = 36;

      if (latest.temperature < tempMin) {
        alerts.push({
          title: `🥶 ${hiveId} - Nízka teplota`,
          body: `${latest.temperature.toFixed(1)}°C (optimum: ${tempMin}-${tempMax}°C)`,
          tag: 'temperature-low',
          data: { url: '/', hiveId, type: 'temperature' }
        });
      } else if (latest.temperature > tempMax) {
        alerts.push({
          title: `🔥 ${hiveId} - Vysoká teplota`,
          body: `${latest.temperature.toFixed(1)}°C (optimum: ${tempMin}-${tempMax}°C)`,
          tag: 'temperature-high',
          data: { url: '/', hiveId, type: 'temperature' }
        });
      }
    }

    // 3. HUMIDITY CHECK
    if (settings.humidity) {
      const humidMin = 40;
      const humidMax = 70;

      if (latest.humidity < humidMin) {
        alerts.push({
          title: `💧 ${hiveId} - Nízka vlhkosť`,
          body: `${latest.humidity.toFixed(1)}% (optimum: ${humidMin}-${humidMax}%)`,
          tag: 'humidity-low',
          data: { url: '/', hiveId, type: 'humidity' }
        });
      } else if (latest.humidity > humidMax) {
        alerts.push({
          title: `💦 ${hiveId} - Vysoká vlhkosť`,
          body: `${latest.humidity.toFixed(1)}% (optimum: ${humidMin}-${humidMax}%)`,
          tag: 'humidity-high',
          data: { url: '/', hiveId, type: 'humidity' }
        });
      }
    }

    // 4. BATTERY CHECK (<20%)
    if (settings.battery) {
      if (latest.battery < 20) {
        alerts.push({
          title: `🔋 ${hiveId} - Nízka batéria`,
          body: `${latest.battery}% - Nabite zariadenie`,
          tag: 'battery-low',
          data: { url: '/', hiveId, type: 'battery' }
        });
      }
    }

    // 5. WEIGHT CHANGE CHECK (>2kg change in last hour)
    if (settings.weight) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const previousReading = await Reading.findOne({
        hiveId,
        timestamp: { $lte: oneHourAgo }
      }).sort({ timestamp: -1 });

      if (previousReading) {
        const weightChange = Math.abs(latest.weight - previousReading.weight);
        if (weightChange > 2) {
          const direction = latest.weight > previousReading.weight ? 'Nárast' : 'Pokles';
          const hint = latest.weight > previousReading.weight ? 'prítok medu' : 'možný problém';
          alerts.push({
            title: `⚖️ ${hiveId} - Zmena hmotnosti`,
            body: `${direction} o ${weightChange.toFixed(2)}kg (${hint})`,
            tag: 'weight-change',
            data: { url: '/', hiveId, type: 'weight' }
          });
        }
      }
    }

    res.json({
      alerts,
      latest: {
        temperature: latest.temperature,
        humidity: latest.humidity,
        weight: latest.weight,
        battery: latest.battery,
        timestamp: latest.timestamp
      }
    });

  } catch (error) {
    console.error('Error checking notification conditions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
