import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useHive } from '../context/HiveContext'
import { useNotifications } from '../contexts/NotificationContext'
import HiveSelector from '../components/HiveSelector'
import { DashboardSkeleton } from '../components/Skeleton'
import './Dashboard.css'
import { putItem as idbPutItem, getAllItems as idbGetAllItems } from '../lib/indexeddb'
import { formatTimeAgo } from '../utils/dateUtils'

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
  
  useEffect(() => {
    if (!selectedHive) {
      setLoading(false) // No hive - stop loading immediately
      return
    }
    
    setLoading(true) // Start loading when hive is available
    fetchLatestData()
    fetch24hHistory()
    const saved = localStorage.getItem('beehive-settings')
    const intervalMinutes = saved ? (JSON.parse(saved).updateInterval || 30) : 30
    const interval = setInterval(() => {
      fetchLatestData()
      fetch24hHistory()
    }, intervalMinutes * 60 * 1000) // Refresh based on settings (minutes)
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
        try { await idbPutItem(DB_NAME, LATEST_STORE, { id: `latest-${selectedHive}`, hiveId: selectedHive, fetchedAt: Date.now(), item: result }) } catch (e) {}
        // Check notification conditions after fetching new data
        const hive = getCurrentHive()
        await checkConditions(selectedHive, hive?.name)
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
        try { await idbPutItem(DB_NAME, HISTORY_STORE, { id: `history-${selectedHive}`, hiveId: selectedHive, fetchedAt: Date.now(), items: result }) } catch (e) {}
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
    const saved = JSON.parse(localStorage.getItem('beehive-settings') || '{}')
    const tempMin = saved.tempMin ?? 30
    const tempMax = saved.tempMax ?? 36
    const humidityMin = saved.humidityMin ?? 40
    const humidityMax = saved.humidityMax ?? 70

    switch(type) {
      case 'temperature':
        if (value < tempMin - 2) return { status: 'critical', color: 'var(--primary)', text: 'Príliš nízka' }
        if (value < tempMin) return { status: 'warning', color: 'var(--warning)', text: 'Nízka' }
        if (value <= tempMax) return { status: 'good', color: 'var(--success)', text: 'Optimálna' }
        if (value <= tempMax + 2) return { status: 'warning', color: 'var(--warning)', text: 'Vysoká' }
        return { status: 'critical', color: 'var(--danger)', text: 'Príliš vysoká' }
      case 'humidity':
        if (value < humidityMin) return { status: 'warning', color: 'var(--warning)', text: 'Nízka' }
        if (value <= humidityMax) return { status: 'good', color: 'var(--success)', text: 'Optimálna' }
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

  const getRssiChartData = () => {
    return history24h
      .filter(item => item.metadata?.rssi != null)
      .map(item => ({
        value: item.metadata.rssi,
        time: new Date(item.timestamp).getTime()
      }))
  }

  // Compute approximate deltas and %/rate for a metric based on nearest historical points
  const computeDeltas = (field) => {
    if (!history24h || history24h.length === 0) return { delta1h: null, delta24h: null, pct24h: null }
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
    const pct24h = (delta24h != null && val24h !== 0 && val24h != null) ? (delta24h / Math.abs(val24h)) * 100 : null

    return { delta1h, delta24h, pct24h }
  }
  
  // Render compact delta badge
  const renderDeltaBadge = (field, unit) => {
    const { delta1h, delta24h, pct24h } = computeDeltas(field)
    if (delta24h == null) return null
    
    const isPositive = delta24h >= 0
    const isSignificant = Math.abs(delta24h) > 0.01
    
    // For weight, positive is usually good (honey flow), for battery negative is bad
    const getColor = () => {
      if (!isSignificant) return 'var(--text-secondary)'
      if (field === 'battery') return isPositive ? 'var(--success)' : 'var(--danger)'
      if (field === 'weight') return isPositive ? 'var(--success)' : 'var(--warning)'
      // Temperature/humidity - depends on context, use neutral
      return isPositive ? 'var(--success)' : 'var(--info)'
    }
    
    const formatValue = (val) => {
      if (field === 'weight') return val.toFixed(2)
      if (field === 'battery') return val.toFixed(0)
      return val.toFixed(1)
    }
    
    return (
      <div className="delta-badges">
        {delta1h != null && (
          <span className="delta-badge" style={{ color: getColor() }}>
            <span className="delta-label">1h</span>
            <span className="delta-value">{isPositive ? '↑' : '↓'} {formatValue(Math.abs(delta1h))}{unit}</span>
          </span>
        )}
        {delta24h != null && (
          <span className="delta-badge" style={{ color: getColor() }}>
            <span className="delta-label">24h</span>
            <span className="delta-value">{isPositive ? '↑' : '↓'} {formatValue(Math.abs(delta24h))}{unit}</span>
            {pct24h != null && Math.abs(pct24h) >= 0.1 && (
              <span className="delta-pct">({isPositive ? '+' : ''}{pct24h.toFixed(1)}%)</span>
            )}
          </span>
        )}
      </div>
    )
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
            <p className="subtitle">Monitorovanie úľov</p>
          </div>
        </header>
        <DashboardSkeleton />
      </div>
    )
  }

  const overallStatus = getOverallStatus()
  const savedSettings = JSON.parse(localStorage.getItem('beehive-settings') || '{}')
  const thresholds = {
    tempMin: savedSettings.tempMin ?? 30,
    tempMax: savedSettings.tempMax ?? 36,
    humidityMin: savedSettings.humidityMin ?? 40,
    humidityMax: savedSettings.humidityMax ?? 70
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🐝 Beehive Monitor</h1>
          <p className="subtitle">Monitorovanie úľov</p>
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

      <div className="metrics-grid-modern">
        {/* Temperature Card */}
        <div className="metric-card-modern">
          <div className="metric-header">
            <span className="metric-icon-modern">🌡️</span>
            <span className="metric-label-modern">Vnútorná teplota</span>
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
          {renderDeltaBadge('temperature', '°C')}
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
          <div className="metric-range-modern">Optimum: {thresholds.tempMin}-{thresholds.tempMax}°C</div>
        </div>

        {/* Humidity Card */}
        <div className="metric-card-modern">
          <div className="metric-header">
            <span className="metric-icon-modern">💧</span>
            <span className="metric-label-modern">Vnútorná vlhkosť</span>
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
          {renderDeltaBadge('humidity', '%')}
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
          <div className="metric-range-modern">Optimum: {thresholds.humidityMin}-{thresholds.humidityMax}%</div>
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
          {renderDeltaBadge('weight', 'kg')}
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
          {renderDeltaBadge('battery', '%')}
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

        {/* Signal Strength Card - LoRa */}
        {data.metadata?.rssi != null && (
          <div className="metric-card-modern">
            <div className="metric-header">
              <span className="metric-icon-modern">📡</span>
              <span className="metric-label-modern">LoRa Signál</span>
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
              {data.metadata?.snr != null && (
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
              )}
            </div>
            {getRssiChartData().length > 1 && (
              <div className="mini-chart">
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={getRssiChartData()}>
                    <Line type="monotone" dataKey="value" stroke={
                      data.metadata.rssi > -90 ? 'var(--success)' :
                      data.metadata.rssi > -110 ? 'var(--warning)' : 'var(--danger)'
                    } strokeWidth={2} dot={false} />
                    <Tooltip 
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#9ca3af' }}
                      formatter={(value) => [`${value} dBm`, 'RSSI']}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
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

    </div>
  )
}
