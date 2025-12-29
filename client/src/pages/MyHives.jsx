import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useHive } from '../context/HiveContext'
import './MyHives.css'

export default function MyHives() {
  const { hives, addHive, updateHive, deleteHive, setSelectedHive } = useHive()
  const { refreshUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
  const colors = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b']

  const [form, setForm] = useState({ id: '', name: '', location: '', color: colors[0], imageDataUrl: '', coordinates: { lat: '', lng: '' }, visibility: 'private', device: { type: 'manual', devEUI: '', deviceId: '' } })
  const [isSaving, setIsSaving] = useState(false)

  const [deletedHive, setDeletedHive] = useState(null)
  const undoTimerRef = useRef(null)

  const openAddModal = () => {
    setModalMode('add')
    setForm({ id: '', name: '', location: '', color: colors[0], imageDataUrl: '', coordinates: { lat: '', lng: '' }, visibility: 'private', device: { type: 'manual', devEUI: '', deviceId: '' } })
    setShowModal(true)
  }

  const openEditModal = (hive) => {
    setModalMode('edit')
    setForm({ id: hive.id, name: hive.name || '', location: hive.location || '', color: hive.color || 'var(--warning)', imageDataUrl: hive.image || '' })
    setShowModal(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm(prev => ({ ...prev, imageDataUrl: reader.result }))
    reader.readAsDataURL(file)
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.warning('Tvoj prehliadač nepodporuje geolokáciu')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({ ...prev, coordinates: { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) } }))
        toast.success('GPS súradnice získané!')
      },
      (err) => {
        console.error('Geolocation error', err)
        toast.error('Nepodarilo sa získať polohu')
      }
    )
  }

  const handleSave = async (e) => {
    e && e.preventDefault()
    if (!form.name) {
      toast.warning('Vyplň názov úľa')
      return
    }

    setIsSaving(true)

    try {
        if (modalMode === 'add') {
        const tempId = `HIVE-${Date.now()}`
        const optimistic = { id: tempId, name: form.name, location: form.location, color: form.color, image: form.imageDataUrl, coordinates: form.coordinates, visibility: form.visibility, device: form.device }
        addHive(optimistic)
        setShowModal(false)
        setSelectedHive(tempId)
        navigate('/inspection')

        const hiveData = { name: form.name, location: form.location, color: form.color, visibility: form.visibility, device: { type: form.device.type } }
        if (form.coordinates?.lat && form.coordinates?.lng) hiveData.coordinates = { lat: parseFloat(form.coordinates.lat), lng: parseFloat(form.coordinates.lng) }
        if (form.device?.type === 'esp32-lorawan' && form.device.devEUI) hiveData.device.devEUI = form.device.devEUI.toUpperCase()
        if (form.device?.type === 'esp32-wifi' && form.device.deviceId) hiveData.device.deviceId = form.device.deviceId
        if (form.imageDataUrl) hiveData.image = form.imageDataUrl

        const res = await fetch('/api/users/me/hives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(hiveData)
        })

        if (res.ok) {
          await refreshUser()
          toast.success(`Úľ "${form.name}" bol vytvorený`)
        } else {
          const err = await res.json().catch(() => ({ message: 'Neznáma chyba' }))
          deleteHive(tempId)
          toast.error(`Chyba: ${err.message}`)
        }
      } else if (modalMode === 'edit') {
        const hiveId = form.id
        updateHive(hiveId, { name: form.name, location: form.location, color: form.color, image: form.imageDataUrl, coordinates: form.coordinates, visibility: form.visibility, device: form.device })
        setShowModal(false)

        const hiveData = { name: form.name, location: form.location, color: form.color, visibility: form.visibility, device: { type: form.device.type } }
        if (form.coordinates?.lat && form.coordinates?.lng) hiveData.coordinates = { lat: parseFloat(form.coordinates.lat), lng: parseFloat(form.coordinates.lng) }
        if (form.device?.type === 'esp32-lorawan' && form.device.devEUI) hiveData.device.devEUI = form.device.devEUI.toUpperCase()
        if (form.device?.type === 'esp32-wifi' && form.device.deviceId) hiveData.device.deviceId = form.device.deviceId
        if (form.imageDataUrl) hiveData.image = form.imageDataUrl

        const res = await fetch(`/api/users/me/hives/${hiveId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(hiveData)
        })

        if (res.ok) {
          await refreshUser()
          toast.success('Úľ upravený')
        } else {
          const err = await res.json().catch(() => ({ message: 'Neznáma chyba' }))
          toast.error(`Chyba: ${err.message}`)
        }
      }
    } catch (error) {
      console.error('Save hive error', error)
      toast.error('Nepodarilo sa uložiť úľ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (hive) => {
    if (!hives || hives.length === 1) {
      toast.warning('Nemôžeš vymazať posledný úľ!')
      return
    }
    if (!confirm(`Naozaj chceš vymazať úľ "${hive.name}"?`)) return

    // Remove locally and keep backup for undo
    deleteHive(hive.id)
    setDeletedHive(hive)
    // start undo timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setDeletedHive(null), 8000)

    try {
      const res = await fetch(`/api/users/me/hives/${hive.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        await refreshUser()
        toast.success('Úľ vymazaný')
      } else {
        const err = await res.json().catch(() => ({ message: 'Neznáma chyba' }))
        toast.error(`Chyba: ${err.message}`)
      }
    } catch (err) {
      console.error('Delete error', err)
      toast.error('Chyba pri mazaní úľa')
    }
  }

  const handleUndo = async () => {
    if (!deletedHive) return
    const hive = deletedHive
    setDeletedHive(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    // Recreate on server
    try {
      const hiveData = { name: hive.name, location: hive.location, color: hive.color }
      if (hive.image) hiveData.image = hive.image
      const res = await fetch('/api/users/me/hives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(hiveData)
      })
      if (res.ok) {
        await refreshUser()
        toast.success('Zrušenie vymazania: úľ obnovený')
      } else {
        const err = await res.json().catch(() => ({ message: 'Neznáma chyba' }))
        toast.error(`Nepodarilo sa obnoviť úľ: ${err.message}`)
      }
    } catch (err) {
      console.error('Undo error', err)
      toast.error('Nepodarilo sa obnoviť úľ')
    }
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
          <button className="btn" onClick={openAddModal}>➕ Pridať úľ</button>
        </div>
      </header>

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
                <button className="btn btn-sm" onClick={() => openEditModal(h)}>✏️</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(h)}>🗑️</button>
              </div>
            </div>
          </div>
        )) : (
          <div className="empty-state">Nemáte žiadne úle. Kliknite na "Pridať úľ" pre vytvorenie nového.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{modalMode === 'add' ? '➕ Pridať úľ' : '✏️ Upraviť úľ'}</h3>
            <form onSubmit={handleSave} className="modal-form">
              <label>Názov *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

              <label>Lokalita (voliteľné)</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />

                <label>Farba</label>
                <div className="color-picker">
                  {colors.map(c => (
                    <button key={c} type="button" className={`color-option ${form.color === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                  ))}
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
                </div>

                <label>Fotka (voliteľné)</label>
                <input type="file" accept="image/*" onChange={handleFileChange} />
                {form.imageDataUrl && <img src={form.imageDataUrl} alt="preview" className="image-preview" />}

                <label>GPS súradnice (voliteľné)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input placeholder="lat" value={form.coordinates.lat} onChange={e => setForm(f => ({ ...f, coordinates: { ...f.coordinates, lat: e.target.value } }))} />
                  <input placeholder="lng" value={form.coordinates.lng} onChange={e => setForm(f => ({ ...f, coordinates: { ...f.coordinates, lng: e.target.value } }))} />
                  <button type="button" className="btn" onClick={getCurrentLocation}>📍 Použiť moju polohu</button>
                </div>

                <label>Typ zariadenia</label>
                <select value={form.device.type} onChange={e => setForm(f => ({ ...f, device: { ...f.device, type: e.target.value, devEUI: '', deviceId: '' } }))}>
                  <option value="manual">📝 Manuálne zadávanie</option>
                  <option value="esp32-wifi">📡 ESP32 WiFi</option>
                  <option value="esp32-lorawan">📶 ESP32 LoRaWAN</option>
                </select>
                {form.device.type === 'esp32-lorawan' && (
                  <input placeholder="DevEUI (16 hex)" value={form.device.devEUI} onChange={e => setForm(f => ({ ...f, device: { ...f.device, devEUI: e.target.value.toUpperCase() } }))} maxLength={16} />
                )}
                {form.device.type === 'esp32-wifi' && (
                  <input placeholder="Device ID" value={form.device.deviceId} onChange={e => setForm(f => ({ ...f, device: { ...f.device, deviceId: e.target.value } }))} />
                )}

                <label>Viditeľnosť</label>
                <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
                  <option value="private">🔒 Súkromný</option>
                  <option value="public">🌍 Verejný</option>
                </select>

              <div className="form-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>Zrušiť</button>
                <button className="btn btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Ukladám...' : 'Uložiť'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletedHive && (
        <div className="undo-banner">
          <span>Úľ "{deletedHive.name}" vymazaný.</span>
          <button className="btn btn-link" onClick={handleUndo}>Zrušiť</button>
        </div>
      )}
    </div>
  )
}
