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
  const [activeTab, setActiveTab] = useState('form') // 'form' | 'history'
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
  const [historyLimit, setHistoryLimit] = useState(10)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (selectedHive) {
      fetchInspectionHistory()
    }
  }, [selectedHive, historyLimit]) // Re-fetch when hive or limit changes

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
      const response = await fetch(`/api/inspection/history?limit=${historyLimit}&hiveId=${selectedHive}`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
        setHasMore(data.length === historyLimit)
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

  const resetForm = () => {
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
    setEditingId(null)
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
        resetForm()
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
    setActiveTab('form')
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
        resetForm()
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

  const checklistItems = [
    { key: 'pollen', title: 'Peľ', desc: 'Prítomný peľ v pláste', icon: '🌼' },
    { key: 'capped', title: 'Zapečatený plod', desc: 'Bunky so zapečateným plodom', icon: '📦' },
    { key: 'opened', title: 'Otvorený plod', desc: 'Bunky s otvoreným plodom', icon: '📂' },
    { key: 'eggs', title: 'Vajíčka', desc: 'Viditeľné vajíčka v bunkách', icon: '🥚' },
    { key: 'queenSeen', title: 'Kráľovná videná', desc: 'Kráľovná bola spozorovaná', icon: '👑' },
    { key: 'queenbeeCell', title: 'Matečník otvorený', desc: 'Otvorený matečník v úli', icon: '🏠' },
    { key: 'queenbeeCellCapped', title: 'Matečník zapečatený', desc: 'Zapečatený matečník v úli', icon: '🔒' },
    { key: 'inspectionNeeded', title: 'Vyžaduje kontrolu', desc: 'Úľ vyžaduje ďalšiu kontrolu', icon: '⚠️', warning: true }
  ]

  const badgeLabels = {
    pollen: '🌼 Peľ',
    capped: '📦 Zapečatený',
    opened: '📂 Otvorený',
    eggs: '🥚 Vajíčka',
    queenSeen: '👑 Kráľovná',
    queenbeeCell: '🏠 Matečník',
    queenbeeCellCapped: '🔒 Zapečatený matečník',
    inspectionNeeded: '⚠️ Vyžaduje kontrolu'
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

      {/* Tab navigation */}
      <div className="inspection-tabs">
        <button 
          className={`inspection-tab ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          {editingId ? '✏️ Úprava' : '➕ Nová kontrola'}
        </button>
        <button 
          className={`inspection-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 História {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
      </div>

      {/* Form tab */}
      {activeTab === 'form' && (
        <div className="inspection-form-panel">
          <div className="checklist-section">
            <h2>Stav úľa</h2>
            
            <div className="checklist-grid">
              {checklistItems.map(item => (
                <div 
                  key={item.key}
                  className={`checklist-item ${checklist[item.key] ? 'checked' : ''} ${item.warning && checklist[item.key] ? 'warning' : ''}`}
                  onClick={() => handleToggle(item.key)}
                >
                  <div className="check-icon">
                    {checklist[item.key] ? (item.warning ? '⚠️' : '✅') : '⬜'}
                  </div>
                  <div className="check-label">
                    <div className="check-title">{item.title}</div>
                    <div className="check-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
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
              <div className="form-actions-row">
                <button 
                  className="save-btn"
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? 'Aktualizujem...' : '✏️ Aktualizovať kontrolu'}
                </button>
                <button 
                  className="cancel-btn"
                  onClick={resetForm}
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
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="inspection-history-panel">
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>Zatiaľ žiadne záznamy</p>
            </div>
          ) : (
            <>
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={item._id || index} className="history-item">
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
                      {Object.entries(item.checklist || {}).map(([key, val]) => 
                        val && badgeLabels[key] ? (
                          <span 
                            key={key} 
                            className={`check-badge ${key === 'inspectionNeeded' ? 'warning' : ''}`}
                          >
                            {badgeLabels[key]}
                          </span>
                        ) : null
                      )}
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
              {hasMore && (
                <button 
                  className="btn btn-secondary load-more-btn" 
                  onClick={() => setHistoryLimit(prev => prev + 10)}
                >
                  Načítať ďalšie
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
