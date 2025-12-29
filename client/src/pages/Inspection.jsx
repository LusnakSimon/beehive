import { useState, useEffect } from 'react'
import { useHive } from '../context/HiveContext'
import { useToast } from '../contexts/ToastContext'
import HiveSelector from '../components/HiveSelector'
import './Inspection.css'
import useOfflineQueue from '../hooks/useOfflineQueue'
import { addItem as idbAddItem, getAllItems as idbGetAllItems } from '../lib/indexeddb'

const DB_NAME = 'beehive-cache-v1'
const INSPECTION_STORE = 'inspections'

export default function Inspection() {
  const { selectedHive } = useHive()
  const toast = useToast()
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
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (selectedHive) {
      fetchInspectionHistory()
    }
  }, [selectedHive]) // Re-fetch when hive changes

  // Setup offline queue with a send function that posts to the server
  const sendInspection = async (payload) => {
    const res = await fetch('/api/inspection/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Network response not ok')
    return res
  }

  const { enqueue } = useOfflineQueue(sendInspection)

  const fetchInspectionHistory = async () => {
    if (!selectedHive) return
    
    try {
      const response = await fetch(`/api/inspection/history?limit=10&hiveId=${selectedHive}`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
        try {
          // cache the fetched history locally for offline fallback
          await idbAddItem(DB_NAME, INSPECTION_STORE, { hiveId: selectedHive, fetchedAt: Date.now(), items: data })
        } catch (err) {
          // ignore cache errors
        }
        return
      }
    } catch (error) {
      console.error('Chyba pri načítaní histórie inšpekcií:', error)
      // fallback to cached history
      try {
        const cached = await idbGetAllItems(DB_NAME, INSPECTION_STORE)
        // find latest cache for this hive
        const latest = (cached || []).reverse().find(c => c.hiveId === selectedHive)
        if (latest && latest.items) setHistory(latest.items)
      } catch (err) {
        console.error('Error reading inspection cache', err)
      }
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
      const payload = {
        checklist,
        notes,
        timestamp: new Date(),
        hiveId: selectedHive
      }

      const result = await enqueue(payload)

      // If offline (queued), optimistically add to local history and cache
      const optimisticItem = { _id: `offline-${Date.now()}`, checklist, notes, timestamp: payload.timestamp }
      setHistory(prev => [optimisticItem, ...prev])
      try { await idbAddItem(DB_NAME, INSPECTION_STORE, { hiveId: selectedHive, fetchedAt: Date.now(), items: [optimisticItem] }) } catch (e) {}

      if (result.sent) {
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
        // Refresh history from server
        fetchInspectionHistory()
      } else {
        toast.info('Práca v režime offline — inšpekcia uložená lokálne a odošle sa pri návrate online')
      }
    } catch (error) {
      console.error('Chyba pri ukladaní inšpekcie:', error)
      toast.error('Nepodarilo sa uložiť inšpekciu')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (inspectionId) => {
    if (!confirm('Naozaj chcete vymazať túto kontrolu?')) {
      return
    }

    try {
      const response = await fetch(`/api/inspection/${inspectionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchInspectionHistory()
      } else {
        toast.error('Nepodarilo sa vymazať kontrolu')
      }
    } catch (error) {
      console.error('Chyba pri mazaní kontroly:', error)
      toast.error('Nepodarilo sa vymazať kontrolu')
    }
  }

  const handleEdit = (inspection) => {
    setEditingId(inspection._id)
    setChecklist(inspection.checklist)
    setNotes(inspection.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUpdate = async () => {
    if (!editingId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/inspection/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist,
          notes
        })
      })

      if (response.ok) {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
        
        // Reset form and editing state
        setEditingId(null)
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
      console.error('Chyba pri aktualizácii kontroly:', error)
      toast.error('Nepodarilo sa aktualizovať kontrolu')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
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

      <div className="hive-selector-container">
        <HiveSelector />
      </div>

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

          {editingId ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="save-btn"
                onClick={handleUpdate}
                disabled={loading}
              >
                {loading ? 'Aktualizujem...' : '✏️ Aktualizovať kontrolu'}
              </button>
              <button 
                className="cancel-btn"
                onClick={handleCancelEdit}
                disabled={loading}
              >
                ✕ Zrušiť
              </button>
            </div>
          ) : (
            <button 
              className="save-btn"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Ukladám...' : '💾 Uložiť kontrolu'}
            </button>
          )}
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
                    {item.checklist.inspectionNeeded && <span className="check-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>⚠️ Inspection Needed</span>}
                  </div>
                  
                  {item.notes && (
                    <div className="history-notes">
                      📝 {item.notes}
                    </div>
                  )}
                  
                  <div className="history-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => handleEdit(item)}
                      title="Upraviť kontrolu"
                    >
                      ✏️ Upraviť
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDelete(item._id)}
                      title="Vymazať kontrolu"
                    >
                      🗑️ Vymazať
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
