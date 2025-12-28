import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHive } from '../context/HiveContext'
import './HiveSelector.css'

export default function HiveSelector() {
  const { selectedHive, setSelectedHive, hives, addHive } = useHive()
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const [showAddForm, setShowAddForm] = useState(false)
  const [formName, setFormName] = useState('Môj prvý úľ')
  const [formColor, setFormColor] = useState('#fbbf24')
  const [formVisibility, setFormVisibility] = useState('private')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // If hives is undefined, still loading. If hives is empty, show an "Add hive" selector.
  if (!hives) {
    return (
      <div className="hive-selector">
        <div className="hive-selector-loading">
          <div className="loading-spinner-small"></div>
          <span>Načítavam úle...</span>
        </div>
      </div>
    )
  }

  if (Array.isArray(hives) && hives.length === 0) {
    return (
      <div className="hive-selector">
        {!showAddForm ? (
          <>
            <button
              className="hive-selector-btn empty"
              onClick={() => setShowAddForm(true)}
            >
              <div className="hive-icon empty">➕</div>
              <div className="hive-info">
                <div className="hive-name">Pridať úľ</div>
                <div className="hive-location">Zatiaľ žiadne úle</div>
              </div>
            </button>
            <div className="hive-selector-help">Klikni pre vytvorenie nového úľa.</div>
          </>
        ) : (
          <div className="hive-add-form">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Názov úľa" />
            <div className="hive-add-row">
              <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} />
              <select value={formVisibility} onChange={e => setFormVisibility(e.target.value)}>
                <option value="private">Súkromný</option>
                <option value="public">Verejný</option>
              </select>
            </div>
            {formError && <div className="error">{formError}</div>}
            <div className="hive-add-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setFormError(null) }} disabled={saving}>Zrušiť</button>
              <button className="btn btn-primary" onClick={async () => {
                setSaving(true); setFormError(null);
                try {
                  const res = await fetch('/api/users/me/hives', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: formName, color: formColor, visibility: formVisibility })
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Chyba pri vytváraní')
                  addHive(data.hive)
                  setSelectedHive(data.hive.id)
                  setShowAddForm(false)
                  setIsOpen(false)
                } catch (err) {
                  setFormError(err.message)
                } finally { setSaving(false) }
              }} disabled={saving}>{saving ? 'Ukladám...' : 'Vytvoriť'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const currentHive = hives.find(h => h.id === selectedHive) || hives[0]

  const handleSelect = (hiveId) => {
    setSelectedHive(hiveId)
    setIsOpen(false)
  }

  return (
    <div className="hive-selector">
      <button 
        className="hive-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{ borderColor: currentHive?.color }}
      >
        <div className="hive-icon" style={{ backgroundColor: currentHive?.color }}>
          🐝
        </div>
        <div className="hive-info">
          <div className="hive-name">{currentHive?.name}</div>
          <div className="hive-location">{currentHive?.location}</div>
        </div>
        <div className="dropdown-arrow">
          {isOpen ? '▲' : '▼'}
        </div>
      </button>

      {isOpen && (
        <>
          <div className="hive-dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className="hive-dropdown">
              {hives.map(hive => (
                <button
                  key={hive.id}
                  className={`hive-dropdown-item ${hive.id === selectedHive ? 'active' : ''}`}
                  onClick={() => handleSelect(hive.id)}
                >
                  <div className="hive-icon" style={{ backgroundColor: hive.color }}>
                    🐝
                  </div>
                  <div className="hive-info">
                    <div className="hive-name">{hive.name}</div>
                    <div className="hive-location">{hive.location}</div>
                  </div>
                  {hive.id === selectedHive && (
                    <div className="check-icon">✓</div>
                  )}
                </button>
              ))}

              {/* Add-new-hive item (opens inline form) */}
              {!showAddForm ? (
                <button
                  key="__add_hive"
                  className="hive-dropdown-item add"
                  onClick={() => setShowAddForm(true)}
                >
                  <div className="hive-icon" style={{ backgroundColor: 'var(--primary)' }}>
                    ➕
                  </div>
                  <div className="hive-info">
                    <div className="hive-name">Pridať nový úľ</div>
                    <div className="hive-location">Vytvoriť nový úľ</div>
                  </div>
                </button>
              ) : (
                <div className="hive-dropdown-item form">
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Názov úľa" />
                  <div className="hive-add-row">
                    <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} />
                    <select value={formVisibility} onChange={e => setFormVisibility(e.target.value)}>
                      <option value="private">Súkromný</option>
                      <option value="public">Verejný</option>
                    </select>
                  </div>
                  {formError && <div className="error">{formError}</div>}
                  <div className="hive-add-actions">
                    <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setFormError(null) }} disabled={saving}>Zrušiť</button>
                    <button className="btn btn-primary" onClick={async () => {
                      setSaving(true); setFormError(null);
                      try {
                        const res = await fetch('/api/users/me/hives', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: formName, color: formColor, visibility: formVisibility })
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Chyba pri vytváraní')
                        addHive(data.hive)
                        setSelectedHive(data.hive.id)
                        setShowAddForm(false)
                        setIsOpen(false)
                      } catch (err) {
                        setFormError(err.message)
                      } finally { setSaving(false) }
                    }} disabled={saving}>{saving ? 'Ukladám...' : 'Vytvoriť'}</button>
                  </div>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  )
}
