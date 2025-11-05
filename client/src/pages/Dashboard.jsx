import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import './Dashboard.css'

export default function Dashboard() {
  const [data, setData] = useState({
    temperature: 0,
    humidity: 0,
    weight: 0,
    battery: 0,
    lastUpdate: null
  })
  const [previousData, setPreviousData] = useState(null)
  const [history24h, setHistory24h] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchLatestData()
    fetch24hHistory()
    const interval = setInterval(() => {
      fetchLatestData()
      fetch24hHistory()
    }, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchLatestData = async () => {
    try {
      setIsRefreshing(true)
      const response = await fetch('/api/sensor/latest')
      if (response.ok) {
        const result = await response.json()
        setPreviousData(data)
        setData(result)
      }
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const fetch24hHistory = async () => {
    try {
      const response = await fetch('/api/sensor/history?range=24h')
      if (response.ok) {
        const result = await response.json()
        setHistory24h(result.slice(-24)) // Last 24 data points
      }
    } catch (error) {
      console.error('Chyba pri načítaní histórie:', error)
    }
  }

  const getMetricStatus = (type, value) => {
    switch(type) {
      case 'temperature':
        if (value < 28) return { status: 'critical', color: '#3b82f6', text: 'Príliš nízka' }
        if (value < 30) return { status: 'warning', color: '#f59e0b', text: 'Nízka' }
        if (value <= 36) return { status: 'good', color: '#10b981', text: 'Optimálna' }
        if (value <= 38) return { status: 'warning', color: '#f59e0b', text: 'Vysoká' }
        return { status: 'critical', color: '#ef4444', text: 'Príliš vysoká' }
      case 'humidity':
        if (value < 40) return { status: 'warning', color: '#f59e0b', text: 'Nízka' }
        if (value <= 70) return { status: 'good', color: '#10b981', text: 'Optimálna' }
        return { status: 'warning', color: '#f59e0b', text: 'Vysoká' }
      case 'weight':
        if (value < 20) return { status: 'critical', color: '#ef4444', text: 'Kriticky nízka' }
        if (value < 40) return { status: 'warning', color: '#f59e0b', text: 'Nízka' }
        return { status: 'good', color: '#10b981', text: 'V norme' }
      case 'battery':
        if (value < 15) return { status: 'critical', color: '#ef4444', text: 'Kritická' }
        if (value < 30) return { status: 'warning', color: '#f59e0b', text: 'Nízka' }
        return { status: 'good', color: '#10b981', text: 'Dobrá' }
      default:
        return { status: 'good', color: '#10b981', text: 'OK' }
    }
  }

  const getTrend = (current, previous) => {
    if (!previous) return null
    const diff = current - previous
    if (Math.abs(diff) < 0.1) return { icon: '→', text: 'Stabilná', color: '#6b7280' }
    if (diff > 0) return { icon: '↗', text: `+${diff.toFixed(1)}`, color: '#10b981' }
    return { icon: '↘', text: diff.toFixed(1), color: '#ef4444' }
  }

  const getMiniChartData = (field) => {
    return history24h.map(item => ({
      value: item[field],
      time: new Date(item.timestamp).getTime()
    }))
  }

  const getOverallStatus = () => {
    const tempStatus = getMetricStatus('temperature', data.temperature)
    const humidStatus = getMetricStatus('humidity', data.humidity)
    const weightStatus = getMetricStatus('weight', data.weight)
    
    if (tempStatus.status === 'critical' || humidStatus.status === 'critical' || weightStatus.status === 'critical') {
      return { text: 'KRITICKÝ STAV', color: '#ef4444', icon: '⚠️' }
    }
    if (tempStatus.status === 'warning' || humidStatus.status === 'warning' || weightStatus.status === 'warning') {
      return { text: 'VYŽADUJE POZORNOSŤ', color: '#f59e0b', icon: '⚡' }
    }
    return { text: 'VŠETKO V PORIADKU', color: '#10b981', icon: '✓' }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Načítavam dáta z úľa...</p>
      </div>
    )
  }

  const overallStatus = getOverallStatus()

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🐝 Beehive Monitor</h1>
          <p className="subtitle">Real-time monitorovanie</p>
        </div>
        <button 
          className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={fetchLatestData}
          disabled={isRefreshing}
        >
          <span className="refresh-icon">🔄</span>
          <span>Obnoviť</span>
        </button>
      </header>
      
      <div className="status-banner-modern" style={{ borderLeftColor: overallStatus.color }}>
        <div className="status-icon" style={{ backgroundColor: overallStatus.color }}>
          {overallStatus.icon}
        </div>
        <div className="status-content">
          <div className="status-title" style={{ color: overallStatus.color }}>
            {overallStatus.text}
          </div>
          <div className="status-time">
            {data.lastUpdate ? new Date(data.lastUpdate).toLocaleString('sk-SK', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Žiadne dáta'}
          </div>
        </div>
      </div>

      <div className="metrics-grid-modern">
        {/* Temperature Card */}
        <div className="metric-card-modern">
          <div className="metric-header">
            <span className="metric-icon-modern">🌡️</span>
            <span className="metric-label-modern">Teplota</span>
          </div>
          <div className="metric-main">
            <span className="metric-value-large">{data.temperature.toFixed(1)}</span>
            <span className="metric-unit">°C</span>
          </div>
          {previousData && getTrend(data.temperature, previousData.temperature) && (
            <div className="metric-trend" style={{ color: getTrend(data.temperature, previousData.temperature).color }}>
              <span>{getTrend(data.temperature, previousData.temperature).icon}</span>
              <span>{getTrend(data.temperature, previousData.temperature).text}</span>
            </div>
          )}
          <div className="metric-status-badge" style={{ backgroundColor: getMetricStatus('temperature', data.temperature).color }}>
            {getMetricStatus('temperature', data.temperature).text}
          </div>
          {history24h.length > 0 && (
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={getMiniChartData('temperature')}>
                  <Line type="monotone" dataKey="value" stroke={getMetricStatus('temperature', data.temperature).color} strokeWidth={2} dot={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(value) => [`${value.toFixed(1)}°C`, 'Teplota']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="metric-range-modern">Optimum: 30-36°C</div>
        </div>

        {/* Humidity Card */}
        <div className="metric-card-modern">
          <div className="metric-header">
            <span className="metric-icon-modern">💧</span>
            <span className="metric-label-modern">Vlhkosť</span>
          </div>
          <div className="metric-main">
            <span className="metric-value-large">{data.humidity.toFixed(1)}</span>
            <span className="metric-unit">%</span>
          </div>
          {previousData && getTrend(data.humidity, previousData.humidity) && (
            <div className="metric-trend" style={{ color: getTrend(data.humidity, previousData.humidity).color }}>
              <span>{getTrend(data.humidity, previousData.humidity).icon}</span>
              <span>{getTrend(data.humidity, previousData.humidity).text}</span>
            </div>
          )}
          <div className="metric-status-badge" style={{ backgroundColor: getMetricStatus('humidity', data.humidity).color }}>
            {getMetricStatus('humidity', data.humidity).text}
          </div>
          {history24h.length > 0 && (
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={getMiniChartData('humidity')}>
                  <Line type="monotone" dataKey="value" stroke={getMetricStatus('humidity', data.humidity).color} strokeWidth={2} dot={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(value) => [`${value.toFixed(1)}%`, 'Vlhkosť']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="metric-range-modern">Optimum: 40-70%</div>
        </div>

        {/* Weight Card */}
        <div className="metric-card-modern">
          <div className="metric-header">
            <span className="metric-icon-modern">⚖️</span>
            <span className="metric-label-modern">Hmotnosť</span>
          </div>
          <div className="metric-main">
            <span className="metric-value-large">{data.weight.toFixed(2)}</span>
            <span className="metric-unit">kg</span>
          </div>
          {previousData && getTrend(data.weight, previousData.weight) && (
            <div className="metric-trend" style={{ color: getTrend(data.weight, previousData.weight).color }}>
              <span>{getTrend(data.weight, previousData.weight).icon}</span>
              <span>{getTrend(data.weight, previousData.weight).text}</span>
            </div>
          )}
          <div className="metric-status-badge" style={{ backgroundColor: getMetricStatus('weight', data.weight).color }}>
            {getMetricStatus('weight', data.weight).text}
          </div>
          {history24h.length > 0 && (
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={getMiniChartData('weight')}>
                  <Line type="monotone" dataKey="value" stroke={getMetricStatus('weight', data.weight).color} strokeWidth={2} dot={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(value) => [`${value.toFixed(2)} kg`, 'Hmotnosť']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="metric-range-modern">Minimum: 20 kg</div>
        </div>

        {/* Battery Card */}
        <div className="metric-card-modern">
          <div className="metric-header">
            <span className="metric-icon-modern">🔋</span>
            <span className="metric-label-modern">Batéria</span>
          </div>
          <div className="metric-main">
            <span className="metric-value-large">{data.battery}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="battery-bar">
            <div 
              className="battery-fill" 
              style={{ 
                width: `${data.battery}%`,
                backgroundColor: getMetricStatus('battery', data.battery).color
              }}
            ></div>
          </div>
          <div className="metric-status-badge" style={{ backgroundColor: getMetricStatus('battery', data.battery).color }}>
            {getMetricStatus('battery', data.battery).text}
          </div>
          <div className="metric-range-modern">
            {data.battery > 30 ? '✓ Dostačujúce napätie' : '⚠️ Nabite batériu'}
          </div>
        </div>
      </div>
    </div>
  )
}
