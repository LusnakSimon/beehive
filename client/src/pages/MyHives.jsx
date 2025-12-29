import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHive } from '../context/HiveContext'
import './MyHives.css'

export default function MyHives() {
  const { hives, addHive, setSelectedHive } = useHive()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', location: '', image: '', color: '' })

  const handleAdd = (e) => {
    e.preventDefault()
    const id = `HIVE-${Date.now()}`
    const newHive = { id, name: form.name || `Úľ ${id}`, location: form.location || '', image: form.image || '', color: form.color || 'var(--primary)' }
    // optimistic add locally
    addHive(newHive)
    setForm({ name: '', location: '', image: '', color: '' })
    setShowAdd(false)
    setSelectedHive(newHive.id)
    navigate('/inspection')
  }

  const goTo = (hiveId, path) => {
    setSelectedHive(hiveId)
    navigate(path)
  }

  return (
    <div className="my-hives-page">
      <header className="my-hives-header">
        <h1>Moje úle</h1>
        <div className="actions">
          <button className="btn" onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Zrušiť' : 'Pridať úľ'}</button>
        </div>
      </header>

      {showAdd && (
        <form className="add-hive-form" onSubmit={handleAdd}>
          <input placeholder="Názov úľa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input placeholder="Miesto / lokalita" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <input placeholder="URL fotky (voliteľné)" value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Uložiť</button>
            <button type="button" className="btn" onClick={() => setShowAdd(false)}>Zrušiť</button>
          </div>
        </form>
      )}

      <div className="hives-grid">
        {hives && hives.length > 0 ? hives.map(h => (
          <div className="hive-card" key={h.id} style={{ borderColor: h.color || 'var(--border)' }}>
            <div className="hive-image" style={{ backgroundImage: h.image ? `url(${h.image})` : 'none', backgroundColor: h.color || 'var(--card-bg)' }}>
              {!h.image && <div className="hive-initial">{(h.name || '').charAt(0) || 'U'}</div>}
            </div>
            <div className="hive-body">
              <div className="hive-name">{h.name}</div>
              <div className="hive-location">{h.location}</div>
              <div className="hive-actions">
                <button className="btn btn-sm" onClick={() => goTo(h.id, '/history')}>História</button>
                <button className="btn btn-sm" onClick={() => goTo(h.id, '/inspection')}>Kontroly</button>
                <button className="btn btn-sm" onClick={() => goTo(h.id, '/settings')}>Nastavenia</button>
              </div>
            </div>
          </div>
        )) : (
          <div className="empty-state">Nemáte žiadne úle. Kliknite na "Pridať úľ" pre vytvorenie nového.</div>
        )}
      </div>
    </div>
  )
}
