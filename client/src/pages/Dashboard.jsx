import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useHive } from '../context/HiveContext'
import { useNotifications } from '../contexts/NotificationContext'
import HiveSelector from '../components/HiveSelector'
import VarroaReminder from '../components/VarroaReminder'
import './Dashboard.css'

export default function Dashboard() {
  const { selectedHive, getCurrentHive } = useHive()
  const { checkConditions } = useNotifications()
  const [data, setData] = useState({
    temperature: 0,
    humidity: 0,
    weight: 0,
    battery: 0,
    lastUpdate: null,
    metadata: null
  })
  const [previousData, setPreviousData] = useState(null)
  const [history24h, setHistory24h] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Helper function to format time ago
  const formatTimeAgo = (date) => {
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Práve teraz'
    if (diffMins < 60) return `Pred ${diffMins} min`
    if (diffHours < 24) return `Pred ${diffHours} hod`
    if (diffDays === 1) return 'Včera'
    return `Pred ${diffDays} dňami`
  }

  useEffect(() => {
    if (!selectedHive) {
      setLoading(false) // No hive - stop loading immediately
      return
    }
    
    setLoading(true) // Start loading when hive is available
    fetchLatestData()
    fetch24hHistory()
    const interval = setInterval(() => {
      fetchLatestData()
      fetch24hHistory()
    }, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [selectedHive]) // Re-fetch when hive changes

  const fetchLatestData = async () => {
    if (!selectedHive) return
    
    try {
      setIsRefreshing(true)
      const response = await fetch(`/api/sensor/latest?hiveId=${selectedHive}`)
      if (response.ok) {
        const result = await response.json()
        setPreviousData(data)
        setData(result)
        
        // Check notification conditions after fetching new data
        await checkConditions(selectedHive)
      }
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const fetch24hHistory = async () => {
    if (!selectedHive) return
    
    try {
      const response = await fetch(`/api/sensor/history?range=24h&hiveId=${selectedHive}`)
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

      <div className="hive-selector-container">
        <HiveSelector />
      </div>
      
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

      {/* Device Status Card - LoRaWAN Info */}
      {getCurrentHive()?.device?.type === 'esp32-lorawan' && (
        <div className="device-status-card">
          <div className="device-header">
            <span className="device-icon">📶</span>
            <span className="device-title">LoRaWAN Zariadenie</span>
          </div>
          <div className="device-info-grid">
            <div className="device-info-item">
              <span className="device-info-label">DevEUI:</span>
              <span className="device-info-value" style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                {getCurrentHive()?.device?.devEUI || 'Nezadané'}
              </span>
            </div>
            {getCurrentHive()?.device?.lastSeen && (
              <div className="device-info-item">
                <span className="device-info-label">Naposledy videné:</span>
                <span className="device-info-value">
                  {formatTimeAgo(new Date(getCurrentHive().device.lastSeen))}
                </span>
              </div>
            )}
            {getCurrentHive()?.device?.signalStrength !== null && getCurrentHive()?.device?.signalStrength !== undefined && (
              <div className="device-info-item">
                <span className="device-info-label">Signál (RSSI):</span>
                <span className="device-info-value" style={{ 
                  color: getCurrentHive().device.signalStrength > -100 ? '#10b981' : '#f59e0b' 
                }}>
                  {getCurrentHive().device.signalStrength} dBm
                </span>
              </div>
            )}
            {getCurrentHive()?.device?.batteryLevel !== null && getCurrentHive()?.device?.batteryLevel !== undefined && (
              <div className="device-info-item">
                <span className="device-info-label">Batéria:</span>
                <span className="device-info-value" style={{ 
                  color: getCurrentHive().device.batteryLevel > 30 ? '#10b981' : getCurrentHive().device.batteryLevel > 15 ? '#f59e0b' : '#ef4444'
                }}>
                  🔋 {getCurrentHive().device.batteryLevel}%
                </span>
              </div>
            )}
          </div>
          {!getCurrentHive()?.device?.lastSeen && (
            <div className="device-waiting">
              ⏳ Čakám na prvé dáta z LoRaWAN siete...
            </div>
          )}
        </div>
      )}

      {/* Other device types info */}
      {getCurrentHive()?.device?.type && getCurrentHive().device.type !== 'esp32-lorawan' && (
        <div className="device-status-card">
          <div className="device-header">
            <span className="device-icon">
              {getCurrentHive().device.type === 'esp32-wifi' ? '📡' : 
               getCurrentHive().device.type === 'manual' ? '📝' : '📲'}
            </span>
            <span className="device-title">
              {getCurrentHive().device.type === 'esp32-wifi' ? 'ESP32 WiFi' :
               getCurrentHive().device.type === 'manual' ? 'Manuálne zadávanie' : 
               getCurrentHive().device.type === 'esp32-lte' ? 'ESP32 LTE' : 'Neznámy typ'}
            </span>
          </div>
        </div>
      )}

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

        {/* Signal Strength Card - Only for LoRaWAN */}
        {data.metadata?.rssi && data.metadata?.snr && (
          <div className="metric-card-modern">
            <div className="metric-header">
              <span className="metric-icon-modern">📡</span>
              <span className="metric-label-modern">LoRaWAN Signál</span>
            </div>
            <div className="signal-indicators">
              <div className="signal-item">
                <div className="signal-label">RSSI</div>
                <div className="signal-value">
                  <span className="signal-number">{data.metadata.rssi}</span>
                  <span className="signal-unit">dBm</span>
                </div>
                <div className={`signal-quality ${
                  data.metadata.rssi > -90 ? 'good' : 
                  data.metadata.rssi > -110 ? 'warning' : 'poor'
                }`}>
                  {data.metadata.rssi > -90 ? '🟢 Silný' : 
                   data.metadata.rssi > -110 ? '🟡 Stredný' : '🔴 Slabý'}
                </div>
              </div>
              <div className="signal-item">
                <div className="signal-label">SNR</div>
                <div className="signal-value">
                  <span className="signal-number">{data.metadata.snr}</span>
                  <span className="signal-unit">dB</span>
                </div>
                <div className={`signal-quality ${
                  data.metadata.snr > 0 ? 'good' : 
                  data.metadata.snr > -10 ? 'warning' : 'poor'
                }`}>
                  {data.metadata.snr > 0 ? '🟢 Vynikajúci' : 
                   data.metadata.snr > -10 ? '🟡 Dobrý' : '🔴 Slabý'}
                </div>
              </div>
            </div>
            {data.metadata?.source && (
              <div className="gateway-info">
                <div className="gateway-label">Zdroj</div>
                <div className="gateway-id">{data.metadata.source}</div>
              </div>
            )}
            {data.metadata?.gatewayId && (
              <div className="gateway-info">
                <div className="gateway-label">Gateway</div>
                <div className="gateway-id">{data.metadata.gatewayId}</div>
              </div>
            )}
            {data.metadata?.spreadingFactor && (
              <div className="metric-range-modern">
                SF{data.metadata.spreadingFactor} @ {(data.metadata.frequency / 1000000).toFixed(1)} MHz
              </div>
            )}
          </div>
        )}
      </div>
      
      <VarroaReminder />
    </div>
  )
}
