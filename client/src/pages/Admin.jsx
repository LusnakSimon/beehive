import { useState } from 'react'
import './Admin.css'

export default function Admin() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const generateTestData = async (days) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          days: days,
          pointsPerDay: 24
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
            Vygeneruj realistické testovacie dáta s dennými cyklami teploty, vlhkosti a postupným nárastom hmotnosti.
          </p>

          <div className="button-grid">
            <button
              className="admin-btn btn-primary"
              onClick={() => generateTestData(7)}
              disabled={loading}
            >
              {loading ? '⏳ Generujem...' : '�� Generuj 7 dní'}
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
            <pre>{JSON.stringify(result, null, 2)}</pre>
            <p className="result-hint">
              Teraz môžeš prejsť na Dashboard alebo História a vidieť nové dáta v grafoch! 📈
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
          </ul>
        </div>
      </div>
    </div>
  )
}
