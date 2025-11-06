import { useState, useEffect } from 'react'
import './Inspection.css'

export default function Inspection() {
  const [checklist, setChecklist] = useState({
    pollen: false,
    capped: false,
    opened: false,
    eggs: false,
    queenSeen: false,
    queenbeeCell: false,
    queenbeeCellCapped: false,
    inspectionNeeded: false
  })
  
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    fetchInspectionHistory()
  }, [])

  const fetchInspectionHistory = async () => {
    try {
      const response = await fetch('/api/inspection/history?limit=10')
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error('Chyba pri načítaní histórie inšpekcií:', error)
    }
  }

  const handleToggle = (field) => {
    setChecklist(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist,
          notes,
          timestamp: new Date()
        })
      })

      if (response.ok) {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
        
        // Reset form
        setChecklist({
          pollen: false,
          capped: false,
          opened: false,
          eggs: false,
          queenSeen: false,
          queenbeeCell: false,
          queenbeeCellCapped: false,
          inspectionNeeded: false
        })
        setNotes('')
        
        // Refresh history
        fetchInspectionHistory()
      }
    } catch (error) {
      console.error('Chyba pri ukladaní inšpekcie:', error)
      alert('Nepodarilo sa uložiť inšpekciu')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (item) => {
    const positiveCount = Object.values(item.checklist)
      .filter(v => v === true).length
    
    if (positiveCount >= 5) return 'status-good'
    if (positiveCount >= 3) return 'status-warning'
    return 'status-danger'
  }

  return (
    <div className="inspection">
      <header className="inspection-header">
        <div>
          <h1>📋 Kontrola úľa</h1>
          <p className="subtitle-inspection">Zaznamenaj stav úľa</p>
        </div>
      </header>

      {showSuccess && (
        <div className="success-banner">
          ✅ Inšpekcia úspešne uložená!
        </div>
      )}

      <div className="inspection-container">
        <div className="checklist-section">
          <h2>Stav úľa</h2>
          
          <div className="checklist-grid">
            <div 
              className={`checklist-item ${checklist.pollen ? 'checked' : ''}`}
              onClick={() => handleToggle('pollen')}
            >
              <div className="check-icon">
                {checklist.pollen ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Pollen</div>
                <div className="check-desc">Prítomný peľ v pláste</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.capped ? 'checked' : ''}`}
              onClick={() => handleToggle('capped')}
            >
              <div className="check-icon">
                {checklist.capped ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Capped cells</div>
                <div className="check-desc">Zapečatený plod</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.opened ? 'checked' : ''}`}
              onClick={() => handleToggle('opened')}
            >
              <div className="check-icon">
                {checklist.opened ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Opened cells</div>
                <div className="check-desc">Otvorený plod</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.eggs ? 'checked' : ''}`}
              onClick={() => handleToggle('eggs')}
            >
              <div className="check-icon">
                {checklist.eggs ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Eggs</div>
                <div className="check-desc">Viditeľné vajíčka</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.queenSeen ? 'checked' : ''}`}
              onClick={() => handleToggle('queenSeen')}
            >
              <div className="check-icon">
                {checklist.queenSeen ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Queen seen</div>
                <div className="check-desc">Kráľovná videná</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.queenbeeCell ? 'checked' : ''}`}
              onClick={() => handleToggle('queenbeeCell')}
            >
              <div className="check-icon">
                {checklist.queenbeeCell ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Queenbee cell opened</div>
                <div className="check-desc">Matečník otvorený</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.queenbeeCellCapped ? 'checked' : ''}`}
              onClick={() => handleToggle('queenbeeCellCapped')}
            >
              <div className="check-icon">
                {checklist.queenbeeCellCapped ? '✅' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Queenbee cell capped</div>
                <div className="check-desc">Matečník zapečatený</div>
              </div>
            </div>

            <div 
              className={`checklist-item ${checklist.inspectionNeeded ? 'checked' : ''}`}
              onClick={() => handleToggle('inspectionNeeded')}
            >
              <div className="check-icon">
                {checklist.inspectionNeeded ? '⚠️' : '⬜'}
              </div>
              <div className="check-label">
                <div className="check-title">Inspection needed</div>
                <div className="check-desc">Vyžaduje kontrolu</div>
              </div>
            </div>
          </div>

          <div className="notes-section">
            <label htmlFor="notes">Poznámky</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pridaj poznámky k tejto kontrole..."
              rows={4}
            />
          </div>

          <button 
            className="save-btn"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Ukladám...' : '💾 Uložiť kontrolu'}
          </button>
        </div>

        <div className="history-section">
          <h2>História kontrol</h2>
          
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>Zatiaľ žiadne záznamy</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item, index) => (
                <div key={index} className={`history-item ${getStatusColor(item)}`}>
                  <div className="history-header">
                    <div className="history-date">
                      {new Date(item.timestamp).toLocaleDateString('sk-SK', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="history-time">
                      {new Date(item.timestamp).toLocaleTimeString('sk-SK', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  
                  <div className="history-checklist">
                    {item.checklist.pollen && <span className="check-badge">🌼 Pollen</span>}
                    {item.checklist.capped && <span className="check-badge">📦 Capped</span>}
                    {item.checklist.opened && <span className="check-badge">📂 Opened</span>}
                    {item.checklist.eggs && <span className="check-badge">🥚 Eggs</span>}
                    {item.checklist.queenSeen && <span className="check-badge">👑 Queen</span>}
                    {item.checklist.queenbeeCell && <span className="check-badge">🏠 Cell</span>}
                  </div>
                  
                  {item.notes && (
                    <div className="history-notes">
                      📝 {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
