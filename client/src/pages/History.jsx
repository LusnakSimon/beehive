import { useState, useEffect, useMemo } from 'react'
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush 
} from 'recharts'
import { useHive } from '../context/HiveContext'
import HiveSelector from '../components/HiveSelector'
import './History.css'
import { addItem as idbAddItem, getAllItems as idbGetAllItems } from '../lib/indexeddb'
import useOfflineStatus from '../hooks/useOfflineStatus'

const DB_NAME = 'beehive-cache-v1'
const HISTORY_STORE = 'sensor-history'
const STATS_STORE = 'sensor-stats'
const OUTBOX_DB = 'beehive-offline-v1'
const OUTBOX_STORE = 'outbox'

// Analysis helper functions
const calculateTrend = (values) => {
  if (values.length < 2) return { direction: 'stable', change: 0 }
  const firstHalf = values.slice(0, Math.floor(values.length / 2))
  const secondHalf = values.slice(Math.floor(values.length / 2))
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const change = ((avgSecond - avgFirst) / avgFirst) * 100
  
  if (Math.abs(change) < 2) return { direction: 'stable', change: 0 }
  return { 
    direction: change > 0 ? 'up' : 'down', 
    change: Math.abs(change).toFixed(1) 
  }
}

const detectAnomalies = (data, key) => {
  if (data.length < 10) return []
  const values = data.map(d => d[key]).filter(v => v !== undefined)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length)
  const threshold = 2.5 // Standard deviations for anomaly detection
  
  return data.filter(d => {
    const v = d[key]
    return v !== undefined && Math.abs(v - mean) > threshold * stdDev
  }).map(d => {
    const deviation = (d[key] - mean) / stdDev
    const isHigh = deviation > 0
    
    // Generate human-readable description based on metric and severity
    let description = ''
    let severity = Math.abs(deviation) > 3.5 ? 'high' : 'medium'
    
    if (key === 'temperature') {
      if (isHigh) {
        description = d[key] > 40 ? 'Kriticky vysoká teplota' : 'Nezvyčajne vysoká teplota'
      } else {
        description = d[key] < 20 ? 'Kriticky nízka teplota' : 'Nezvyčajne nízka teplota'
      }
    } else if (key === 'humidity') {
      if (isHigh) {
        description = d[key] > 85 ? 'Veľmi vysoká vlhkosť' : 'Zvýšená vlhkosť'
      } else {
        description = d[key] < 30 ? 'Veľmi nízka vlhkosť' : 'Znížená vlhkosť'
      }
    } else if (key === 'weight') {
      if (isHigh) {
        description = 'Náhly nárast hmotnosti'
      } else {
        description = 'Náhly pokles hmotnosti'
      }
    }
    
    return {
      timestamp: d.timestamp,
      value: d[key],
      deviation: deviation.toFixed(1),
      isHigh,
      description,
      severity,
      key
    }
  })
}

const getSeasonalInsight = () => {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) {
    return { season: 'jar', icon: '🌸', tip: 'Včelstvo sa rozvíja - sledujte nárast hmotnosti a aktivity.' }
  } else if (month >= 5 && month <= 7) {
    return { season: 'leto', icon: '☀️', tip: 'Hlavná sezóna medových tokov - očakávajte rýchly nárast hmotnosti.' }
  } else if (month >= 8 && month <= 10) {
    return { season: 'jeseň', icon: '🍂', tip: 'Príprava na zimu - skontrolujte zásoby a liečenie proti varroáze.' }
  } else {
    return { season: 'zima', icon: '❄️', tip: 'Zimné obdobie - minimalizujte zásahy, sledujte teplotu v úli.' }
  }
}

const estimateBeePopulation = (weight, temperature, humidity) => {
  // Base estimation: average hive weighs ~20-30kg empty, bees add ~3-5kg per 10,000 bees
  // A strong colony has 40,000-60,000 bees
  const emptyHiveWeight = 25 // kg
  const beeWeight = 0.0001 // kg per bee (0.1g)
  const honeyWeight = Math.max(0, weight - emptyHiveWeight - 4) // subtract hive + estimated bee weight
  
  // Estimate: healthy hive at optimal temp (34-35°C) has more bees
  let activityFactor = 1
  if (temperature >= 33 && temperature <= 36) activityFactor = 1.2
  else if (temperature >= 28 && temperature <= 32) activityFactor = 1.0
  else if (temperature < 20 || temperature > 40) activityFactor = 0.6
  
  // Rough estimate based on weight and typical colony sizes
  const estimatedBees = Math.round(Math.max(5000, Math.min(80000, 
    (weight - emptyHiveWeight) * 2000 * activityFactor
  )))
  
  return {
    count: estimatedBees,
    health: temperature >= 33 && temperature <= 36 ? 'excellent' : 
            temperature >= 28 && temperature <= 38 ? 'good' : 'needs attention',
    display: estimatedBees >= 1000 ? `${(estimatedBees / 1000).toFixed(0)}k` : estimatedBees
  }
}

export default function History() {
  const { selectedHive } = useHive()
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [timeRange, setTimeRange] = useState('24h')
  const [chartType, setChartType] = useState('line')
  const [selectedMetric, setSelectedMetric] = useState('all')
  const [loading, setLoading] = useState(true)
  const [queuedInspections, setQueuedInspections] = useState([])
  const [showAnalysis, setShowAnalysis] = useState(true)
  const [showAllAnomalies, setShowAllAnomalies] = useState(false)
  const { queuedCount, isOnline, isReplaying, retry, refreshCount } = useOfflineStatus(selectedHive)

  // Calculate analysis insights
  const analysis = useMemo(() => {
    // Show analysis section even with minimal data - just need stats
    if (!stats) return null
    
    const temps = (data || []).map(d => d.temperature).filter(Boolean)
    const humidities = (data || []).map(d => d.humidity).filter(Boolean)
    const weights = (data || []).map(d => d.weight).filter(Boolean)
    
    // Only calculate trends if we have enough data
    const tempTrend = temps.length >= 2 ? calculateTrend(temps) : { direction: 'stable', change: 0 }
    const humidityTrend = humidities.length >= 2 ? calculateTrend(humidities) : { direction: 'stable', change: 0 }
    const weightTrend = weights.length >= 2 ? calculateTrend(weights) : { direction: 'stable', change: 0 }
    
    // Only detect anomalies if we have enough data
    const tempAnomalies = data && data.length >= 10 ? detectAnomalies(data, 'temperature') : []
    const humidityAnomalies = data && data.length >= 10 ? detectAnomalies(data, 'humidity') : []
    const weightAnomalies = data && data.length >= 10 ? detectAnomalies(data, 'weight') : []
    
    const seasonal = getSeasonalInsight()
    
    // Current values for bee estimate
    const latestData = (data && data.length > 0) ? data[data.length - 1] : {}
    const beeEstimate = estimateBeePopulation(
      latestData.weight || stats.weight?.avg || 30,
      latestData.temperature || stats.temperature?.avg || 30,
      latestData.humidity || stats.humidity?.avg || 50
    )
    
    // Generate insights
    const insights = []
    
    // Temperature insights
    if (stats.temperature?.avg < 30) {
      insights.push({ type: 'warning', icon: '🥶', text: 'Nízka teplota v úli - včely môžu byť v klube' })
    } else if (stats.temperature?.avg > 38) {
      insights.push({ type: 'danger', icon: '🔥', text: 'Vysoká teplota - riziko prehriatia plodu' })
    } else if (stats.temperature?.avg >= 33 && stats.temperature?.avg <= 36) {
      insights.push({ type: 'success', icon: '✅', text: 'Optimálna teplota pre plod (33-36°C)' })
    }
    
    // Weight insights
    if (weightTrend.direction === 'up' && parseFloat(weightTrend.change) > 5) {
      insights.push({ type: 'success', icon: '📈', text: `Hmotnosť rastie (+${weightTrend.change}%) - aktívny znáškový tok` })
    } else if (weightTrend.direction === 'down' && parseFloat(weightTrend.change) > 10) {
      insights.push({ type: 'warning', icon: '📉', text: `Hmotnosť klesá (-${weightTrend.change}%) - skontrolujte zásoby` })
    }
    
    // Humidity insights
    if (stats.humidity?.avg > 80) {
      insights.push({ type: 'warning', icon: '💧', text: 'Vysoká vlhkosť - riziko plesní a chorôb' })
    } else if (stats.humidity?.avg < 40) {
      insights.push({ type: 'info', icon: '🏜️', text: 'Nízka vlhkosť v úli' })
    }
    
    // Anomaly insights
    if (tempAnomalies.length > 0) {
      insights.push({ type: 'info', icon: '⚠️', text: `${tempAnomalies.length} nezvyčajných teplotných výkyvov` })
    }
    
    return {
      tempTrend,
      humidityTrend,
      weightTrend,
      tempAnomalies,
      humidityAnomalies,
      weightAnomalies,
      seasonal,
      beeEstimate,
      insights
    }
  }, [data, stats])

  useEffect(() => {
    if (!selectedHive) {
      setLoading(false)
      return
    }
    fetchHistoricalData()
    fetchStats()
    // also load queued offline inspections for this hive
    loadQueuedInspections()
  }, [timeRange, selectedHive]) // Re-fetch when hive changes

  const loadQueuedInspections = async () => {
    if (!selectedHive) return
    try {
      const out = await idbGetAllItems(OUTBOX_DB, OUTBOX_STORE)
      const matches = (out || []).map(o => o.payload).filter(p => p && p.hiveId === selectedHive && p.checklist)
      // Normalize to history-like items for display
      const normalized = matches.map((p, idx) => ({ _id: `queued-${idx}-${p.timestamp || Date.now()}`, timestamp: p.timestamp || Date.now(), checklist: p.checklist, notes: p.notes, offline: true }))
      setQueuedInspections(normalized)
    } catch (err) {
      // ignore
    }
  }

  // refresh queued list when outbox changes (for simplicity trigger on visibility or manual refresh)
  useEffect(() => {
    refreshCount()
    loadQueuedInspections()
  }, [selectedHive])

  const fetchHistoricalData = async () => {
    if (!selectedHive) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/sensor/history?range=${timeRange}&hiveId=${selectedHive}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
        try { await idbAddItem(DB_NAME, HISTORY_STORE, { hiveId: selectedHive, fetchedAt: Date.now(), items: result }) } catch (e) {}
        return
      }
    } catch (error) {
      console.error('Chyba pri načítaní histórie:', error)
      // fallback to cached history
      try {
        const cached = await idbGetAllItems(DB_NAME, HISTORY_STORE)
        const latest = (cached || []).reverse().find(c => c.hiveId === selectedHive)
        if (latest && latest.items) setData(latest.items)
      } catch (err) {
        console.error('Error reading history cache', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!selectedHive) return
    
    try {
      const response = await fetch(`/api/sensor/stats?range=${timeRange}&hiveId=${selectedHive}`)
      if (response.ok) {
        const result = await response.json()
        setStats(result)
        try { await idbAddItem(DB_NAME, STATS_STORE, { hiveId: selectedHive, fetchedAt: Date.now(), item: result }) } catch (e) {}
        return
      }
    } catch (error) {
      console.error('Chyba pri načítaní štatistík:', error)
      // fallback to cached stats
      try {
        const cached = await idbGetAllItems(DB_NAME, STATS_STORE)
        const latest = (cached || []).reverse().find(c => c.hiveId === selectedHive)
        if (latest && latest.item) setStats(latest.item)
      } catch (err) {
        console.error('Error reading stats cache', err)
      }
    }
  }

  const exportToCSV = () => {
    if (data.length === 0) return
    
    const headers = ['Dátum', 'Čas', 'Teplota (°C)', 'Vlhkosť (%)', 'Hmotnosť (kg)', 'Batéria (%)']
    const csvData = data.map(row => {
      const date = new Date(row.timestamp)
      return [
        date.toLocaleDateString('sk-SK'),
        date.toLocaleTimeString('sk-SK'),
        row.temperature.toFixed(1),
        row.humidity.toFixed(1),
        row.weight.toFixed(2),
        row.battery
      ].join(',')
    })
    
    const csv = [headers.join(','), ...csvData].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `beehive-data-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const formatXAxis = (timestamp) => {
    const date = new Date(timestamp)
    if (timeRange === '6h' || timeRange === '24h') {
      return date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
    } else if (timeRange === '7d') {
      return date.toLocaleDateString('sk-SK', { weekday: 'short', day: '2-digit' })
    } else if (timeRange === '30d' || timeRange === '90d') {
      return date.toLocaleDateString('sk-SK', { day: '2-digit', month: 'short' })
    } else {
      return date.toLocaleDateString('sk-SK', { month: 'short', year: '2-digit' })
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">
            {new Date(label).toLocaleString('sk-SK', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</strong>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const renderChart = (dataKey, name, color, unit) => {
    const chartData = selectedMetric === 'all' || selectedMetric === dataKey ? data : []
    const chartHeight = window.innerWidth < 768 ? 280 : 300
    
    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
            />
            <YAxis stroke="#6b7280" />
            <Tooltip content={<CustomTooltip />} />
            <Brush 
              dataKey="timestamp" 
              height={30} 
              stroke={color}
              tickFormatter={formatXAxis}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color}
              fillOpacity={1}
              fill={`url(#color${dataKey})`}
              strokeWidth={2}
              name={`${name} (${unit})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    } else if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
            />
            <YAxis stroke="#6b7280" />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey={dataKey} 
              fill={color}
              name={`${name} (${unit})`}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    } else {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
            />
            <YAxis stroke="#6b7280" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Brush 
              dataKey="timestamp" 
              height={30} 
              stroke={color}
              tickFormatter={formatXAxis}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color}
              strokeWidth={2}
              dot={false}
              name={`${name} (${unit})`}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Načítavam históriu...</p>
      </div>
    )
  }

  return (
    <div className="history">
      {queuedInspections.length > 0 && (
        <div className="queued-inspections">
          <h3>🕒 Neodoslané inšpekcie (offline)</h3>
          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-sm" onClick={() => retry()} disabled={isReplaying}>
              {isReplaying ? 'Odosielam…' : `Odoslať ${queuedCount} teraz`}
            </button>
          </div>
          {queuedInspections.map(q => (
            <div key={q._id} className="queued-inspection-card">
              <div className="queued-time">{new Date(q.timestamp).toLocaleString()}</div>
              <div className="queued-summary">{q.notes || Object.keys(q.checklist || {}).filter(k => q.checklist[k]).join(', ') || 'Inšpekcia'}</div>
              <div className="queued-badge">Offline</div>
            </div>
          ))}
        </div>
      )}
      <header className="history-header">
        <div>
          <h1>📊 História & Analýza</h1>
          <p className="subtitle-history">Detailné zobrazenie historických dát</p>
        </div>
        <button className="export-btn" onClick={exportToCSV}>
          📥 Export CSV
        </button>
      </header>

      <div className="hive-selector-container">
        <HiveSelector />
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🌡️</div>
            <div className="stat-content">
              <div className="stat-label">Priemerná teplota</div>
              <div className="stat-value">{stats.temperature?.avg?.toFixed(1) || '0'} °C</div>
              <div className="stat-range">
                Min: {stats.temperature?.min?.toFixed(1) || '0'} | 
                Max: {stats.temperature?.max?.toFixed(1) || '0'}
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💧</div>
            <div className="stat-content">
              <div className="stat-label">Priemerná vlhkosť</div>
              <div className="stat-value">{stats.humidity?.avg?.toFixed(1) || '0'} %</div>
              <div className="stat-range">
                Min: {stats.humidity?.min?.toFixed(1) || '0'} | 
                Max: {stats.humidity?.max?.toFixed(1) || '0'}
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⚖️</div>
            <div className="stat-content">
              <div className="stat-label">Priemerná hmotnosť</div>
              <div className="stat-value">{stats.weight?.avg?.toFixed(2) || '0'} kg</div>
              <div className="stat-range">
                Min: {stats.weight?.min?.toFixed(2) || '0'} | 
                Max: {stats.weight?.max?.toFixed(2) || '0'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Section */}
      {analysis && (
        <div className="analysis-section">
          <div className="analysis-header" onClick={() => setShowAnalysis(!showAnalysis)}>
            <h2>🧠 Analýza & Odhady</h2>
            <button className="toggle-btn">{showAnalysis ? '▼' : '▶'}</button>
          </div>
          
          {showAnalysis && (
            <div className="analysis-content">
              {/* Bee Population Estimate */}
              <div className="analysis-card bee-estimate-card">
                <div className="bee-estimate-icon">🐝</div>
                <div className="bee-estimate-content">
                  <div className="bee-count">{analysis.beeEstimate.display}</div>
                  <div className="bee-label">Odhadovaný počet včiel</div>
                  <div className={`bee-health health-${analysis.beeEstimate.health.replace(' ', '-')}`}>
                    {analysis.beeEstimate.health === 'excellent' ? '🌟 Výborný stav' :
                     analysis.beeEstimate.health === 'good' ? '✅ Dobrý stav' : '⚠️ Vyžaduje pozornosť'}
                  </div>
                </div>
              </div>

              {/* Trends Grid */}
              <div className="trends-grid">
                <div className="trend-card">
                  <span className="trend-metric">🌡️ Vonk. teplota</span>
                  <span className={`trend-indicator trend-${analysis.tempTrend.direction}`}>
                    {analysis.tempTrend.direction === 'up' ? '↗️' : 
                     analysis.tempTrend.direction === 'down' ? '↘️' : '→'}
                    {analysis.tempTrend.change > 0 && ` ${analysis.tempTrend.change}%`}
                  </span>
                </div>
                <div className="trend-card">
                  <span className="trend-metric">💧 Vonk. vlhkosť</span>
                  <span className={`trend-indicator trend-${analysis.humidityTrend.direction}`}>
                    {analysis.humidityTrend.direction === 'up' ? '↗️' : 
                     analysis.humidityTrend.direction === 'down' ? '↘️' : '→'}
                    {analysis.humidityTrend.change > 0 && ` ${analysis.humidityTrend.change}%`}
                  </span>
                </div>
                <div className="trend-card">
                  <span className="trend-metric">⚖️ Hmotnosť</span>
                  <span className={`trend-indicator trend-${analysis.weightTrend.direction}`}>
                    {analysis.weightTrend.direction === 'up' ? '↗️' : 
                     analysis.weightTrend.direction === 'down' ? '↘️' : '→'}
                    {analysis.weightTrend.change > 0 && ` ${analysis.weightTrend.change}%`}
                  </span>
                </div>
              </div>

              {/* Seasonal Insight */}
              <div className="seasonal-card">
                <span className="seasonal-icon">{analysis.seasonal.icon}</span>
                <div className="seasonal-content">
                  <strong>Sezónny tip ({analysis.seasonal.season})</strong>
                  <p>{analysis.seasonal.tip}</p>
                </div>
              </div>

              {/* Insights */}
              {analysis.insights.length > 0 && (
                <div className="insights-list">
                  <h3>💡 Poznatky</h3>
                  {analysis.insights.map((insight, idx) => (
                    <div key={idx} className={`insight-item insight-${insight.type}`}>
                      <span className="insight-icon">{insight.icon}</span>
                      <span className="insight-text">{insight.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Anomalies */}
              {(analysis.tempAnomalies.length > 0 || analysis.weightAnomalies.length > 0 || analysis.humidityAnomalies.length > 0) && (
                <div className="anomalies-section">
                  <div className="anomalies-header">
                    <h3>⚠️ Nezvyčajné hodnoty</h3>
                    <span className="anomalies-hint">Automaticky zistené výkyvy mimo bežný rozsah</span>
                  </div>
                  <div className="anomalies-list">
                    {(() => {
                      const allAnomalies = [...analysis.tempAnomalies, ...analysis.humidityAnomalies, ...analysis.weightAnomalies]
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      const displayAnomalies = showAllAnomalies ? allAnomalies : allAnomalies.slice(0, 5)
                      const remainingCount = allAnomalies.length - 5
                      
                      return (
                        <>
                          {displayAnomalies.map((a, idx) => (
                            <div key={idx} className={`anomaly-card anomaly-${a.severity}`}>
                              <div className="anomaly-icon">
                                {a.key === 'temperature' ? '🌡️' : a.key === 'humidity' ? '💧' : '⚖️'}
                              </div>
                              <div className="anomaly-content">
                                <div className="anomaly-description">{a.description}</div>
                                <div className="anomaly-details">
                                  <span className="anomaly-value-display">
                                    {a.key === 'weight' ? `${a.value.toFixed(2)} kg` : `${a.value.toFixed(1)}${a.key === 'temperature' ? '°C' : '%'}`}
                                  </span>
                                  <span className="anomaly-time">
                                    {new Date(a.timestamp).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                              <div className={`anomaly-badge ${a.isHigh ? 'high' : 'low'}`}>
                                {a.isHigh ? '↑ Vysoké' : '↓ Nízke'}
                              </div>
                            </div>
                          ))}
                          {remainingCount > 0 && (
                            <button 
                              className="anomalies-toggle-btn"
                              onClick={() => setShowAllAnomalies(!showAllAnomalies)}
                            >
                              {showAllAnomalies 
                                ? '▲ Zobraziť menej' 
                                : `▼ Zobraziť všetkých ${allAnomalies.length} anomálií`}
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="controls-panel">
        <div className="control-group">
          <label>Časové obdobie</label>
          <div className="button-group time-range-group">
            <button 
              className={`control-btn ${timeRange === '6h' ? 'active' : ''}`}
              onClick={() => setTimeRange('6h')}
            >
              6h
            </button>
            <button 
              className={`control-btn ${timeRange === '24h' ? 'active' : ''}`}
              onClick={() => setTimeRange('24h')}
            >
              1d
            </button>
            <button 
              className={`control-btn ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              1w
            </button>
            <button 
              className={`control-btn ${timeRange === '30d' ? 'active' : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              1m
            </button>
            <button 
              className={`control-btn ${timeRange === '90d' ? 'active' : ''}`}
              onClick={() => setTimeRange('90d')}
            >
              3m
            </button>
            <button 
              className={`control-btn ${timeRange === '180d' ? 'active' : ''}`}
              onClick={() => setTimeRange('180d')}
            >
              6m
            </button>
            <button 
              className={`control-btn ${timeRange === '365d' ? 'active' : ''}`}
              onClick={() => setTimeRange('365d')}
            >
              1y
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Typ grafu</label>
          <div className="button-group">
            <button 
              className={`control-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
            >
              📈 Čiarový
            </button>
            <button 
              className={`control-btn ${chartType === 'area' ? 'active' : ''}`}
              onClick={() => setChartType('area')}
            >
              📊 Plošný
            </button>
            <button 
              className={`control-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
            >
              📊 Stĺpcový
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Metrika</label>
          <div className="button-group">
            <button 
              className={`control-btn ${selectedMetric === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('all')}
            >
              Všetky
            </button>
            <button 
              className={`control-btn ${selectedMetric === 'temperature' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('temperature')}
            >
              🌡️
            </button>
            <button 
              className={`control-btn ${selectedMetric === 'humidity' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('humidity')}
            >
              💧
            </button>
            <button 
              className={`control-btn ${selectedMetric === 'weight' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('weight')}
            >
              ⚖️
            </button>
            <button 
              className={`control-btn ${selectedMetric === 'battery' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('battery')}
            >
              🔋
            </button>
          </div>
        </div>
      </div>

      <div className="charts-container">
        {(selectedMetric === 'all' || selectedMetric === 'temperature') && (
          <div className="chart-card">
            <h3>🌡️ Vonkajšia teplota v čase</h3>
            {renderChart('temperature', 'Teplota', '#f59e0b', '°C')}
          </div>
        )}

        {(selectedMetric === 'all' || selectedMetric === 'humidity') && (
          <div className="chart-card">
            <h3>💧 Vonkajšia vlhkosť v čase</h3>
            {renderChart('humidity', 'Vlhkosť', '#3b82f6', '%')}
          </div>
        )}

        {(selectedMetric === 'all' || selectedMetric === 'weight') && (
          <div className="chart-card">
            <h3>⚖️ Hmotnosť v čase</h3>
            {renderChart('weight', 'Hmotnosť', '#10b981', 'kg')}
          </div>
        )}

        {(selectedMetric === 'all' || selectedMetric === 'battery') && (
          <div className="chart-card">
            <h3>🔋 Batéria v čase</h3>
            {renderChart('battery', 'Batéria', '#ef4444', '%')}
          </div>
        )}
      </div>

      {data.length === 0 && (
        <div className="no-data">
          <p>📭 Žiadne dáta pre vybrané obdobie</p>
        </div>
      )}
    </div>
  )
}
