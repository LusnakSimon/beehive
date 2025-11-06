import { useState } from 'react'
import { useHive } from '../context/HiveContext'
import './Admin.css'

export default function Admin() {
  const { hives } = useHive()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const generateTestData = async (days) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Get all hive IDs from context
      const hiveIds = hives.map(hive => hive.id)
      
      const response = await fetch('/api/test/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          days: days,
          pointsPerDay: 24,
          hiveIds: hiveIds
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Chyba pri generovaní dát')
      }
    } catch (err) {
      setError('Chyba pripojenia: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const clearAllData = async () => {
    if (!confirm('Naozaj chceš vymazať všetky dáta?')) {
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test/clear', {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Chyba pri mazaní dát')
      }
    } catch (err) {
      setError('Chyba pripojenia: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>🔧 Admin Panel</h1>
        <p className="subtitle-admin">Správa testovacích dát</p>
      </header>

      <div className="admin-content">
        <div className="admin-section">
          <h2>📊 Generovanie testovacích dát</h2>
          <p className="section-description">
            Vygeneruj realistické testovacie dáta pre <strong>{hives.length} úle</strong> ({hives.map(h => h.name).join(', ')})
            <br />s dennými cyklami teploty, vlhkosti a postupným nárastom hmotnosti.
          </p>

          <div className="button-grid">
            <button
              className="admin-btn btn-primary"
              onClick={() => generateTestData(7)}
              disabled={loading}
            >
              {loading ? '⏳ Generujem...' : '📅 Generuj 7 dní'}
            </button>

            <button
              className="admin-btn btn-primary"
              onClick={() => generateTestData(14)}
              disabled={loading}
            >
              {loading ? '⏳ Generujem...' : '📅 Generuj 14 dní'}
            </button>

            <button
              className="admin-btn btn-primary"
              onClick={() => generateTestData(30)}
              disabled={loading}
            >
              {loading ? '⏳ Generujem...' : '📅 Generuj 30 dní'}
            </button>
          </div>
        </div>

        <div className="admin-section">
          <h2>🗑️ Vymazanie dát</h2>
          <p className="section-description">
            Vymaž všetky testovacie dáta z databázy. Táto akcia je nenávratná!
          </p>

          <button
            className="admin-btn btn-danger"
            onClick={clearAllData}
            disabled={loading}
          >
            {loading ? '⏳ Mažem...' : '🗑️ Vymazať všetky dáta'}
          </button>
        </div>

        {result && (
          <div className="result-box success">
            <h3>✅ Úspech!</h3>
            <div className="result-details">
              {result.hives && (
                <>
                  <p><strong>Úle:</strong> {result.hives.join(', ')}</p>
                  <p><strong>Celkovo záznamov:</strong> {result.count}</p>
                  <p><strong>Na úľ:</strong> {result.perHive} záznamov</p>
                </>
              )}
              {result.deletedCount !== undefined && (
                <p><strong>Vymazaných záznamov:</strong> {result.deletedCount}</p>
              )}
            </div>
            <p className="result-hint">
              Teraz môžeš prepínať medzi úľami a vidieť rôzne dáta v grafoch! 📈🐝
            </p>
          </div>
        )}

        {error && (
          <div className="result-box error">
            <h3>❌ Chyba</h3>
            <p>{error}</p>
          </div>
        )}

        <div className="info-section">
          <h3>ℹ️ Informácie</h3>
          <ul>
            <li>Každý deň obsahuje 24 meraní (každú hodinu)</li>
            <li>Teplota simuluje denný cyklus (30-36°C)</li>
            <li>Vlhkosť kolíše medzi 40-70%</li>
            <li>Hmotnosť postupne rastie (simulácia produkcie medu)</li>
            <li>Batéria postupne klesá</li>
            <li>Každý úľ má mierne odlišné hodnoty pre realistickosť</li>
          </ul>
        </div>

        <div className="donate-section">
          <a 
            href="https://ko-fi.com/dongfeng400" 
            target="_blank" 
            rel="noopener noreferrer"
            className="donate-link"
          >
            ☕ Support the project
          </a>
        </div>
      </div>
    </div>
  )
}
