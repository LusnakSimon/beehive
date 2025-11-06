const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

// Check conditions and return alerts
router.post('/check', async (req, res) => {
  try {
    const { hiveId } = req.query;
    const settings = req.body;

    if (!hiveId) {
      return res.status(400).json({ error: 'hiveId is required' });
    }

    // Get latest reading
    const latest = await Reading.findOne({ hiveId }).sort({ timestamp: -1 });
    
    if (!latest) {
      return res.json({ alerts: [] });
    }

    const alerts = [];
    const now = new Date();
    const readingAge = (now - new Date(latest.timestamp)) / (1000 * 60); // minutes

    // Check offline status (> 60 minutes)
    if (settings.offline && readingAge > 60) {
      alerts.push({
        title: `⚠️ ${hiveId} - Offline`,
        body: `Zariadenie neodpovedá už ${Math.round(readingAge)} minút`,
        tag: 'offline',
        type: 'offline'
      });
    }

    // Check temperature
    if (settings.temperature) {
      const tempMin = parseFloat(localStorage.getItem('tempMin') || 30);
      const tempMax = parseFloat(localStorage.getItem('tempMax') || 36);
      
      if (latest.temperature < tempMin) {
        alerts.push({
          title: `🥶 ${hiveId} - Nízka teplota`,
          body: `Teplota ${latest.temperature}°C je pod minimom (${tempMin}°C)`,
          tag: 'temperature-low',
          type: 'temperature'
        });
      } else if (latest.temperature > tempMax) {
        alerts.push({
          title: `🔥 ${hiveId} - Vysoká teplota`,
          body: `Teplota ${latest.temperature}°C je nad maximom (${tempMax}°C)`,
          tag: 'temperature-high',
          type: 'temperature'
        });
      }
    }

    // Check humidity
    if (settings.humidity) {
      const humidityMin = parseFloat(localStorage.getItem('humidityMin') || 50);
      const humidityMax = parseFloat(localStorage.getItem('humidityMax') || 60);
      
      if (latest.humidity < humidityMin) {
        alerts.push({
          title: `💧 ${hiveId} - Nízka vlhkosť`,
          body: `Vlhkosť ${latest.humidity}% je pod minimom (${humidityMin}%)`,
          tag: 'humidity-low',
          type: 'humidity'
        });
      } else if (latest.humidity > humidityMax) {
        alerts.push({
          title: `💦 ${hiveId} - Vysoká vlhkosť`,
          body: `Vlhkosť ${latest.humidity}% je nad maximom (${humidityMax}%)`,
          tag: 'humidity-high',
          type: 'humidity'
        });
      }
    }

    // Check battery
    if (settings.battery && latest.battery) {
      if (latest.battery < 20) {
        alerts.push({
          title: `🔋 ${hiveId} - Nízka batéria`,
          body: `Batéria na ${latest.battery}%, nabite zariadenie`,
          tag: 'battery-low',
          type: 'battery'
        });
      }
    }

    // Check weight change (last hour)
    if (settings.weight && latest.weight) {
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const previousReading = await Reading.findOne({
        hiveId,
        timestamp: { $lte: oneHourAgo }
      }).sort({ timestamp: -1 });

      if (previousReading && previousReading.weight) {
        const weightChange = Math.abs(latest.weight - previousReading.weight);
        
        if (weightChange > 2) {
          const direction = latest.weight > previousReading.weight ? 'Nárast' : 'Pokles';
          alerts.push({
            title: `⚖️ ${hiveId} - Zmena hmotnosti`,
            body: `${direction} o ${weightChange.toFixed(1)}kg za hodinu ${latest.weight > previousReading.weight ? '(rojenie?)' : '(krádež?)'}`,
            tag: 'weight-change',
            type: 'weight'
          });
        }
      }
    }

    res.json({ alerts, latest });
  } catch (error) {
    console.error('Error checking conditions:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
