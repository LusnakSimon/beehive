import { useState, useEffect } from 'react'
import './Dashboard.css'

export default function Dashboard() {
  const [data, setData] = useState({
    temperature: 0,
    humidity: 0,
    weight: 0,
    battery: 0,
    lastUpdate: null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestData()
    const interval = setInterval(fetchLatestData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchLatestData = async () => {
    try {
      const response = await fetch('/api/sensor/latest')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (temp) => {
    if (temp < 30) return 'status-cold'
    if (temp > 36) return 'status-hot'
    return 'status-ok'
  }

  if (loading) {
    return <div className="loading">Načítavam dáta...</div>
  }

  return (
    <div className="dashboard">
      <h1>🐝 Monitorovanie úľa</h1>
      
      <div className="status-banner">
        <span className={`status-indicator ${getStatusColor(data.temperature)}`}></span>
        <span>Úľ je v {data.temperature >= 30 && data.temperature <= 36 ? 'optimálnom' : 'neoptimálnom'} stave</span>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">🌡️</div>
          <div className="metric-value">{data.temperature.toFixed(1)}°C</div>
          <div className="metric-label">Teplota</div>
          <div className="metric-range">Optimum: 30-36°C</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💧</div>
          <div className="metric-value">{data.humidity.toFixed(1)}%</div>
          <div className="metric-label">Vlhkosť</div>
          <div className="metric-range">Optimum: 50-60%</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚖️</div>
          <div className="metric-value">{data.weight.toFixed(2)} kg</div>
          <div className="metric-label">Hmotnosť</div>
          <div className="metric-range">Trend: {data.weight > 50 ? '↗️' : '↘️'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔋</div>
          <div className="metric-value">{data.battery}%</div>
          <div className="metric-label">Batéria</div>
          <div className="metric-range">{data.battery > 20 ? 'OK' : '⚠️ Nízka'}</div>
        </div>
      </div>

      <div className="last-update">
        Posledná aktualizácia: {data.lastUpdate ? new Date(data.lastUpdate).toLocaleString('sk-SK') : 'N/A'}
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={fetchLatestData}>
          🔄 Obnoviť dáta
        </button>
      </div>
    </div>
  )
}
