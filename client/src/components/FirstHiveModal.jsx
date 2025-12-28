import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHive } from '../context/HiveContext'

export default function FirstHiveModal() {
  const { user } = useAuth()
  const { hives, addHive, setSelectedHive } = useHive()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('Môj prvý úľ')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user && Array.isArray(user.ownedHives) && user.ownedHives.length === 0) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [user, hives])

  if (!open) return null

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users/me/hives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create hive')

      const hive = data.hive
      addHive(hive)
      setSelectedHive(hive.id)
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="first-hive-modal-overlay">
      <div className="first-hive-modal">
        <h3>Vitaj v Beehive 🐝</h3>
        <p>Vyzerá to, že ešte nemáš vytvorený žiadny úľ. Chceš si vytvoriť prvý úľ teraz?</p>
        <label>
          Názov úľa
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Preskočiť</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Ukladám...' : 'Vytvoriť úľ'}</button>
        </div>
      </div>

      <style>{`
        .first-hive-modal-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:1200}
        .first-hive-modal{background:var(--card-bg, #fff);color:var(--text, #111);padding:20px;border-radius:10px;max-width:420px;width:100%;box-shadow:var(--card-shadow-md)}
        .first-hive-modal h3{margin:0 0 8px}
        .first-hive-modal label{display:block;margin:12px 0}
        .first-hive-modal input{width:100%;padding:8px;border-radius:6px;border:1px solid var(--border)}
        .first-hive-modal .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
        .first-hive-modal .error{color:var(--danger);margin-top:8px}
      `}</style>
    </div>
  )
}
