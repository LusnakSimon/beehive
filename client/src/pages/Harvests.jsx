import { useState, useEffect } from 'react'
import { useHive } from '../context/HiveContext'
import { useToast } from '../contexts/ToastContext'
import HiveSelector from '../components/HiveSelector'
import './Harvests.css'

const HONEY_TYPES = [
  { value: 'flower', label: '🌸 Kvetový', color: '#fbbf24' },
  { value: 'acacia', label: '🌳 Agátový', color: '#fef3c7' },
  { value: 'linden', label: '🌿 Lipový', color: '#d4a574' },
  { value: 'forest', label: '🌲 Lesný', color: '#8b4513' },
  { value: 'sunflower', label: '🌻 Slnečnicový', color: '#fcd34d' },
  { value: 'rapeseed', label: '🌼 Repkový', color: '#fef9c3' },
  { value: 'chestnut', label: '🌰 Gaštanový', color: '#92400e' },
  { value: 'mixed', label: '🍯 Zmiešaný', color: '#f59e0b' },
  { value: 'other', label: '📦 Iný', color: '#9ca3af' }
]

const QUALITY_OPTIONS = [
  { value: 'excellent', label: '⭐ Výborná', color: '#22c55e' },
  { value: 'good', label: '👍 Dobrá', color: '#3b82f6' },
  { value: 'average', label: '👌 Priemerná', color: '#f59e0b' },
  { value: 'poor', label: '👎 Slabá', color: '#ef4444' }
]

export default function Harvests() {
  const { selectedHive } = useHive()
  const toast = useToast()
  const [harvests, setHarvests] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  const [form, setForm] = useState({
    amount: '',
    unit: 'kg',
    honeyType: 'mixed',
    quality: 'good',
    moistureContent: '',
    framesHarvested: '',
    weather: '',
    notes: '',
    harvestDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (selectedHive) {
      fetchHarvests()
      fetchStats()
    }
  }, [selectedHive, selectedYear])

  const fetchHarvests = async () => {
    if (!selectedHive) return
    setLoading(true)
    try {
      const response = await fetch(`/api/harvests?hiveId=${selectedHive}&year=${selectedYear}&limit=50`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setHarvests(data.harvests || [])
      }
    } catch (error) {
      console.error('Error fetching harvests:', error)
      toast.error('Nepodarilo sa načítať zbery')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!selectedHive) return
    try {
      const response = await fetch(`/api/harvests/stats?hiveId=${selectedHive}&year=${selectedYear}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching harvest stats:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.warning('Zadaj platné množstvo medu')
      return
    }

    setLoading(true)
    try {
      const payload = {
        hiveId: selectedHive,
        amount: parseFloat(form.amount),
        unit: form.unit,
        honeyType: form.honeyType,
        quality: form.quality,
        moistureContent: form.moistureContent ? parseFloat(form.moistureContent) : null,
        framesHarvested: form.framesHarvested ? parseInt(form.framesHarvested) : null,
        weather: form.weather,
        notes: form.notes,
        harvestDate: form.harvestDate
      }

      const url = editingId ? `/api/harvests/${editingId}` : '/api/harvests'
      const method = editingId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success(editingId ? 'Zber upravený' : 'Zber uložený')
        resetForm()
        fetchHarvests()
        fetchStats()
      } else {
        const err = await response.json()
        toast.error(err.error || 'Nepodarilo sa uložiť zber')
      }
    } catch (error) {
      console.error('Error saving harvest:', error)
      toast.error('Chyba pri ukladaní zberu')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (harvest) => {
    setForm({
      amount: harvest.amount.toString(),
      unit: harvest.unit || 'kg',
      honeyType: harvest.honeyType || 'mixed',
      quality: harvest.quality || 'good',
      moistureContent: harvest.moistureContent?.toString() || '',
      framesHarvested: harvest.framesHarvested?.toString() || '',
      weather: harvest.weather || '',
      notes: harvest.notes || '',
      harvestDate: new Date(harvest.harvestDate).toISOString().split('T')[0]
    })
    setEditingId(harvest._id)
    setShowForm(true)
  }

  const handleDelete = async (harvestId) => {
    if (!confirm('Naozaj chceš vymazať tento zber?')) return

    try {
      const response = await fetch(`/api/harvests/${harvestId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (response.ok) {
        toast.success('Zber vymazaný')
        fetchHarvests()
        fetchStats()
      } else {
        toast.error('Nepodarilo sa vymazať zber')
      }
    } catch (error) {
      console.error('Error deleting harvest:', error)
      toast.error('Chyba pri mazaní zberu')
    }
  }

  const resetForm = () => {
    setForm({
      amount: '',
      unit: 'kg',
      honeyType: 'mixed',
      quality: 'good',
      moistureContent: '',
      framesHarvested: '',
      weather: '',
      notes: '',
      harvestDate: new Date().toISOString().split('T')[0]
    })
    setEditingId(null)
    setShowForm(false)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('sk-SK', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const getHoneyTypeInfo = (type) => {
    return HONEY_TYPES.find(t => t.value === type) || HONEY_TYPES[7] // Default to mixed
  }

  const getQualityInfo = (quality) => {
    return QUALITY_OPTIONS.find(q => q.value === quality) || QUALITY_OPTIONS[1] // Default to good
  }

  // Generate year options (last 10 years)
  const yearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="harvests-page">
      <header className="harvests-header">
        <h1>🍯 Zbery medu</h1>
        <p className="subtitle">Sleduj svoje zbery a výnosy medu</p>
      </header>

      <div className="hive-selector-container">
        <HiveSelector />
      </div>

      {/* Year Filter */}
      <div className="year-filter">
        <label>Rok:</label>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="year-select"
        >
          {yearOptions.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="harvest-stats">
          <div className="stat-card">
            <div className="stat-icon">🍯</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalAmount?.toFixed(1) || 0} kg</div>
              <div className="stat-label">Celkový výnos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.harvestCount || 0}</div>
              <div className="stat-label">Počet zberov</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚖️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.avgAmount?.toFixed(1) || 0} kg</div>
              <div className="stat-label">Priemerný zber</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Harvest Button */}
      {!showForm && (
        <button className="btn btn-primary add-harvest-btn" onClick={() => setShowForm(true)}>
          ➕ Pridať zber
        </button>
      )}

      {/* Harvest Form */}
      {showForm && (
        <div className="harvest-form-container">
          <div className="harvest-form-header">
            <h2>{editingId ? '✏️ Upraviť zber' : '➕ Nový zber'}</h2>
            <button className="close-btn" onClick={resetForm}>✕</button>
          </div>
          
          <form onSubmit={handleSubmit} className="harvest-form">
            <div className="form-row">
              <div className="form-group">
                <label>Množstvo *</label>
                <div className="amount-input">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.0"
                    required
                  />
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                    <option value="frames">rámikov</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Dátum zberu</label>
                <input
                  type="date"
                  value={form.harvestDate}
                  onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Typ medu</label>
              <div className="honey-type-grid">
                {HONEY_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    className={`honey-type-btn ${form.honeyType === type.value ? 'active' : ''}`}
                    style={{ '--type-color': type.color }}
                    onClick={() => setForm({ ...form, honeyType: type.value })}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Kvalita</label>
              <div className="quality-grid">
                {QUALITY_OPTIONS.map(quality => (
                  <button
                    key={quality.value}
                    type="button"
                    className={`quality-btn ${form.quality === quality.value ? 'active' : ''}`}
                    style={{ '--quality-color': quality.color }}
                    onClick={() => setForm({ ...form, quality: quality.value })}
                  >
                    {quality.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Vlhkosť medu (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="30"
                  value={form.moistureContent}
                  onChange={(e) => setForm({ ...form, moistureContent: e.target.value })}
                  placeholder="18.0"
                />
              </div>

              <div className="form-group">
                <label>Počet rámikov</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={form.framesHarvested}
                  onChange={(e) => setForm({ ...form, framesHarvested: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Počasie</label>
              <input
                type="text"
                value={form.weather}
                onChange={(e) => setForm({ ...form, weather: e.target.value })}
                placeholder="Slnečno, 25°C"
              />
            </div>

            <div className="form-group">
              <label>Poznámky</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Dodatočné poznámky k zberu..."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Zrušiť
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Ukladám...' : (editingId ? 'Uložiť zmeny' : 'Uložiť zber')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Harvest History */}
      <div className="harvest-history">
        <h2>📜 História zberov</h2>
        
        {loading && harvests.length === 0 ? (
          <div className="loading-state">Načítavam zbery...</div>
        ) : harvests.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🍯</span>
            <p>Zatiaľ žiadne zbery v tomto roku</p>
            <p className="hint">Pridaj svoj prvý zber kliknutím na tlačidlo vyššie</p>
          </div>
        ) : (
          <div className="harvest-list">
            {harvests.map(harvest => {
              const typeInfo = getHoneyTypeInfo(harvest.honeyType)
              const qualityInfo = getQualityInfo(harvest.quality)
              
              return (
                <div key={harvest._id} className="harvest-card">
                  <div className="harvest-card-header" style={{ borderLeftColor: typeInfo.color }}>
                    <div className="harvest-date">
                      <span className="date-day">{new Date(harvest.harvestDate).getDate()}</span>
                      <span className="date-month">
                        {new Date(harvest.harvestDate).toLocaleDateString('sk-SK', { month: 'short' })}
                      </span>
                    </div>
                    <div className="harvest-main-info">
                      <div className="harvest-amount">
                        <strong>{harvest.amount}</strong> {harvest.unit}
                      </div>
                      <div className="harvest-type" style={{ color: typeInfo.color }}>
                        {typeInfo.label}
                      </div>
                    </div>
                    <div className="harvest-quality" style={{ color: qualityInfo.color }}>
                      {qualityInfo.label}
                    </div>
                  </div>
                  
                  {(harvest.moistureContent || harvest.framesHarvested || harvest.weather) && (
                    <div className="harvest-details">
                      {harvest.moistureContent && (
                        <span className="detail-item">💧 {harvest.moistureContent}%</span>
                      )}
                      {harvest.framesHarvested && (
                        <span className="detail-item">🖼️ {harvest.framesHarvested} rámikov</span>
                      )}
                      {harvest.weather && (
                        <span className="detail-item">☀️ {harvest.weather}</span>
                      )}
                    </div>
                  )}
                  
                  {harvest.notes && (
                    <div className="harvest-notes">
                      <p>{harvest.notes}</p>
                    </div>
                  )}
                  
                  <div className="harvest-actions">
                    <button 
                      className="btn btn-sm"
                      onClick={() => handleEdit(harvest)}
                    >
                      ✏️ Upraviť
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(harvest._id)}
                    >
                      🗑️ Vymazať
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
