import { useState, useEffect } from 'react'
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush 
} from 'recharts'
import './History.css'

export default function History() {
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [timeRange, setTimeRange] = useState('24h')
  const [chartType, setChartType] = useState('line')
  const [selectedMetric, setSelectedMetric] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistoricalData()
    fetchStats()
  }, [timeRange])

  const fetchHistoricalData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sensor/history?range=${timeRange}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Chyba pri načítaní histórie:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/sensor/stats?range=${timeRange}`)
      if (response.ok) {
        const result = await response.json()
        setStats(result)
      }
    } catch (error) {
      console.error('Chyba pri načítaní štatistík:', error)
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
    if (timeRange === '24h') {
      return date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
    } else if (timeRange === '7d') {
      return date.toLocaleDateString('sk-SK', { day: '2-digit', month: 'short' })
    } else {
      return date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })
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
      <header className="history-header">
        <div>
          <h1>📊 História & Analýza</h1>
          <p className="subtitle-history">Detailné zobrazenie historických dát</p>
        </div>
        <button className="export-btn" onClick={exportToCSV}>
          📥 Export CSV
        </button>
      </header>

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

      <div className="controls-panel">
        <div className="control-group">
          <label>Časové obdobie</label>
          <div className="button-group">
            <button 
              className={`control-btn ${timeRange === '24h' ? 'active' : ''}`}
              onClick={() => setTimeRange('24h')}
            >
              24h
            </button>
            <button 
              className={`control-btn ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              7 dní
            </button>
            <button 
              className={`control-btn ${timeRange === '30d' ? 'active' : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30 dní
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
          </div>
        </div>
      </div>

      <div className="charts-container">
        {(selectedMetric === 'all' || selectedMetric === 'temperature') && (
          <div className="chart-card">
            <h3>🌡️ Teplota v čase</h3>
            {renderChart('temperature', 'Teplota', '#f59e0b', '°C')}
          </div>
        )}

        {(selectedMetric === 'all' || selectedMetric === 'humidity') && (
          <div className="chart-card">
            <h3>💧 Vlhkosť v čase</h3>
            {renderChart('humidity', 'Vlhkosť', '#3b82f6', '%')}
          </div>
        )}

        {(selectedMetric === 'all' || selectedMetric === 'weight') && (
          <div className="chart-card">
            <h3>⚖️ Hmotnosť v čase</h3>
            {renderChart('weight', 'Hmotnosť', '#10b981', 'kg')}
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
