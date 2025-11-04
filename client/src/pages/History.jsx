import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './History.css'

export default function History() {
  const [data, setData] = useState([])
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistoricalData()
  }, [timeRange])

  const fetchHistoricalData = async () => {
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

  return (
    <div className="history">
      <h1>📊 História meraní</h1>

      <div className="time-range-selector">
        <button 
          className={timeRange === '24h' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setTimeRange('24h')}
        >
          24 hodín
        </button>
        <button 
          className={timeRange === '7d' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setTimeRange('7d')}
        >
          7 dní
        </button>
        <button 
          className={timeRange === '30d' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setTimeRange('30d')}
        >
          30 dní
        </button>
      </div>

      {loading ? (
        <div className="loading">Načítavam históriu...</div>
      ) : (
        <>
          <div className="chart-container">
            <h2>Teplota a Vlhkosť</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('sk-SK')}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString('sk-SK')}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#f59e0b" 
                  name="Teplota (°C)"
                  strokeWidth={2}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="humidity" 
                  stroke="#3b82f6" 
                  name="Vlhkosť (%)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h2>Hmotnosť úľa</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('sk-SK')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString('sk-SK')}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#10b981" 
                  name="Hmotnosť (kg)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
