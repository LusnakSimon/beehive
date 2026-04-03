import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHive } from '../context/HiveContext'
import './HiveSelector.css'

export default function HiveSelector() {
  const { selectedHive, setSelectedHive, hives } = useHive()
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  

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
        <button
          className="hive-selector-btn empty"
          onClick={() => navigate('/my-hives')}
        >
          <div className="hive-icon empty">➕</div>
          <div className="hive-info">
            <div className="hive-name">Pridať úľ</div>
          </div>
        </button>
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
      >
        <div className="hive-icon">
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
                  <div className="hive-icon">
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

              <button
                key="__add_hive"
                className="hive-dropdown-item add"
                onClick={() => { setIsOpen(false); navigate('/my-hives') }}
              >
                <div className="hive-icon" style={{ backgroundColor: 'var(--primary)' }}>
                  ➕
                </div>
                <div className="hive-info">
                  <div className="hive-name">Pridať nový úľ</div>
                </div>
              </button>
          </div>
        </>
      )}
    </div>
  )
}
