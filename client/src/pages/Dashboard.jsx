import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useHive } from '../context/HiveContext'
import { useNotifications } from '../contexts/NotificationContext'
import HiveSelector from '../components/HiveSelector'
import VarroaReminder from '../components/VarroaReminder'
import { DashboardSkeleton } from '../components/Skeleton'
import './Dashboard.css'
import { addItem as idbAddItem, getAllItems as idbGetAllItems } from '../lib/indexeddb'

const DB_NAME = 'beehive-cache-v1'
const LATEST_STORE = 'sensor-latest'
const HISTORY_STORE = 'sensor-history'
import useOfflineStatus from '../hooks/useOfflineStatus'

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
  const { queuedCount, isOnline, isReplaying, retry } = useOfflineStatus(selectedHive)

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
        try { await idbAddItem(DB_NAME, LATEST_STORE, { hiveId: selectedHive, fetchedAt: Date.now(), item: result }) } catch (e) {}
        // Check notification conditions after fetching new data
        await checkConditions(selectedHive)
        return
      }
    } catch (error) {
      console.error('Chyba pri načítaní dát:', error)
      // fallback to cached latest
      try {
        const cached = await idbGetAllItems(DB_NAME, LATEST_STORE)
        const latest = (cached || []).reverse().find(c => c.hiveId === selectedHive)
        if (latest && latest.item) {
          setPreviousData(data)
          setData(latest.item)
        }
      } catch (err) {
        console.error('Error reading latest cache', err)
      }
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
        const slice = result.slice(-24)
        setHistory24h(slice) // Last 24 data points
        try { await idbAddItem(DB_NAME, HISTORY_STORE, { hiveId: selectedHive, fetchedAt: Date.now(), items: result }) } catch (e) {}
        return
      }
    } catch (error) {
      console.error('Chyba pri načítaní histórie:', error)
      // fallback to cached history
      try {
        const cached = await idbGetAllItems(DB_NAME, HISTORY_STORE)
        const latest = (cached || []).reverse().find(c => c.hiveId === selectedHive)
        if (latest && latest.items) setHistory24h((latest.items || []).slice(-24))
      } catch (err) {
        console.error('Error reading history cache', err)
      }
    }
  }

  const getMetricStatus = (type, value) => {
    switch(type) {
      case 'temperature':
        if (value < 28) return { status: 'critical', color: 'var(--primary)', text: 'Príliš nízka' }
        if (value < 30) return { status: 'warning', color: 'var(--warning)', text: 'Nízka' }
        if (value <= 36) return { status: 'good', color: 'var(--success)', text: 'Optimálna' }
        if (value <= 38) return { status: 'warning', color: 'var(--warning)', text: 'Vysoká' }
        return { status: 'critical', color: 'var(--danger)', text: 'Príliš vysoká' }
      case 'humidity':
        if (value < 40) return { status: 'warning', color: 'var(--warning)', text: 'Nízka' }
        if (value <= 70) return { status: 'good', color: 'var(--success)', text: 'Optimálna' }
        return { status: 'warning', color: 'var(--warning)', text: 'Vysoká' }
      case 'weight':
        if (value < 20) return { status: 'critical', color: 'var(--danger)', text: 'Kriticky nízka' }
        if (value < 40) return { status: 'warning', color: 'var(--warning)', text: 'Nízka' }
        return { status: 'good', color: 'var(--success)', text: 'V norme' }
      case 'battery':
        if (value < 15) return { status: 'critical', color: 'var(--danger)', text: 'Kritická' }
        if (value < 30) return { status: 'warning', color: 'var(--warning)', text: 'Nízka' }
        return { status: 'good', color: 'var(--success)', text: 'Dobrá' }
      default:
        return { status: 'good', color: 'var(--success)', text: 'OK' }
    }
  }

  const getTrend = (current, previous) => {
    if (!previous) return null
    const diff = current - previous
    if (Math.abs(diff) < 0.1) return { icon: '→', text: 'Stabilná', color: 'var(--text-secondary)' }
    if (diff > 0) return { icon: '↗', text: `+${diff.toFixed(1)}`, color: 'var(--success)' }
    return { icon: '↘', text: diff.toFixed(1), color: 'var(--danger)' }
  }

  const getMiniChartData = (field) => {
    return history24h.map(item => ({
      value: item[field],
      time: new Date(item.timestamp).getTime()
    }))
  }

  // Compute approximate deltas for a metric based on nearest historical point
  const computeDeltas = (field) => {
    if (!history24h || history24h.length === 0) return { delta1h: null, delta24h: null }
    const now = data.lastUpdate ? new Date(data.lastUpdate).getTime() : Date.now()

    const findNearest = (targetMs) => {
      let best = null
      let bestDiff = Infinity
      for (const it of history24h) {
        const t = new Date(it.timestamp).getTime()
        const diff = Math.abs(t - targetMs)
        if (diff < bestDiff) {
          bestDiff = diff
          best = it
        }
      }
      return best
    }

    // target times: ~1 hour ago, ~24 hours ago
    const oneHourMs = 60 * 60 * 1000
    const oneHourTarget = now - oneHourMs
    const dayTarget = now - (24 * oneHourMs)

    const oneHourPoint = findNearest(oneHourTarget)
    const dayPoint = findNearest(dayTarget)

    const latestVal = data[field]
    const val1h = oneHourPoint ? (oneHourPoint[field] ?? null) : null
    const val24h = dayPoint ? (dayPoint[field] ?? null) : null

    const delta1h = (latestVal != null && val1h != null) ? (latestVal - val1h) : null
    const delta24h = (latestVal != null && val24h != null) ? (latestVal - val24h) : null

    return { delta1h, delta24h }
  }

  const getOverallStatus = () => {
    const tempStatus = getMetricStatus('temperature', data.temperature)
    const humidStatus = getMetricStatus('humidity', data.humidity)
    const weightStatus = getMetricStatus('weight', data.weight)
    
    if (tempStatus.status === 'critical' || humidStatus.status === 'critical' || weightStatus.status === 'critical') {
      return { text: 'KRITICKÝ STAV', color: 'var(--danger)', icon: '⚠️' }
    }
    if (tempStatus.status === 'warning' || humidStatus.status === 'warning' || weightStatus.status === 'warning') {
      return { text: 'VYŽADUJE POZORNOSŤ', color: 'var(--warning)', icon: '⚡' }
    }
    return { text: 'VŠETKO V PORIADKU', color: 'var(--success)', icon: '✓' }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content">
            <h1>🐝 Beehive Monitor</h1>
            <p className="subtitle">Real-time monitorovanie</p>
          </div>
        </header>
        <DashboardSkeleton />
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
      {queuedCount > 0 && (
        <div className="queued-count-banner">
          🔁 Máte {queuedCount} položiek čakajúcich na odoslanie (offline)
          <button className="btn btn-sm" onClick={() => retry()} disabled={isReplaying} style={{ marginLeft: '12px' }}>
            {isReplaying ? 'Odosielam…' : 'Odoslať teraz'}
          </button>
        </div>
      )}
      
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
                  color: getCurrentHive().device.signalStrength > -100 ? 'var(--success)' : 'var(--warning)' 
                }}>
                  {getCurrentHive().device.signalStrength} dBm
                </span>
              </div>
            )}
            {getCurrentHive()?.device?.batteryLevel !== null && getCurrentHive()?.device?.batteryLevel !== undefined && (
              <div className="device-info-item">
                <span className="device-info-label">Batéria:</span>
                <span className="device-info-value" style={{ 
                  color: getCurrentHive().device.batteryLevel > 30 ? 'var(--success)' : getCurrentHive().device.batteryLevel > 15 ? 'var(--warning)' : 'var(--danger)'
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
          {/* Hourly / 24h deltas for temperature */}
          {(() => {
            const { delta1h, delta24h } = computeDeltas('temperature')
            return (
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: delta1h == null ? 'var(--text-secondary)' : (delta1h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                  1h: {delta1h == null ? '—' : `${delta1h >= 0 ? '+' : ''}${delta1h.toFixed(1)}°C`}
                </div>
                <div style={{ fontSize: '0.8rem', color: delta24h == null ? 'var(--text-secondary)' : (delta24h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                  24h: {delta24h == null ? '—' : `${delta24h >= 0 ? '+' : ''}${delta24h.toFixed(1)}°C`}
                </div>
              </div>
            )
          })()}
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
          {/* Hourly / 24h deltas for humidity */}
          {(() => {
            const { delta1h, delta24h } = computeDeltas('humidity')
            return (
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: delta1h == null ? 'var(--text-secondary)' : (delta1h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                  1h: {delta1h == null ? '—' : `${delta1h >= 0 ? '+' : ''}${delta1h.toFixed(1)}%`}
                </div>
                <div style={{ fontSize: '0.8rem', color: delta24h == null ? 'var(--text-secondary)' : (delta24h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                  24h: {delta24h == null ? '—' : `${delta24h >= 0 ? '+' : ''}${delta24h.toFixed(1)}%`}
                </div>
              </div>
            )
          })()}
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
            {/* Hourly / 24h deltas */}
            {(() => {
              const { delta1h, delta24h } = computeDeltas('weight')
              return (
                <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: delta1h == null ? 'var(--text-secondary)' : (delta1h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                    1h: {delta1h == null ? '—' : `${delta1h >= 0 ? '+' : ''}${delta1h.toFixed(2)} kg`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: delta24h == null ? 'var(--text-secondary)' : (delta24h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                    24h: {delta24h == null ? '—' : `${delta24h >= 0 ? '+' : ''}${delta24h.toFixed(2)} kg`}
                  </div>
                </div>
              )
            })()}
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
          {/* Hourly / 24h deltas for battery */}
          {(() => {
            const { delta1h, delta24h } = computeDeltas('battery')
            return (
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: delta1h == null ? 'var(--text-secondary)' : (delta1h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                  1h: {delta1h == null ? '—' : `${delta1h >= 0 ? '+' : ''}${delta1h.toFixed(0)}%`}
                </div>
                <div style={{ fontSize: '0.8rem', color: delta24h == null ? 'var(--text-secondary)' : (delta24h >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                  24h: {delta24h == null ? '—' : `${delta24h >= 0 ? '+' : ''}${delta24h.toFixed(0)}%`}
                </div>
              </div>
            )
          })()}
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
