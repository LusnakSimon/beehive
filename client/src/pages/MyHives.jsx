import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useHive } from '../context/HiveContext'
import { compressImage } from '../utils/imageUtils'
import './MyHives.css'

export default function MyHives() {
  const { hives, addHive, updateHive, deleteHive, setSelectedHive } = useHive()
  const { refreshUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
  const colors = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b']

  const [form, setForm] = useState({ id: '', name: '', location: '', color: colors[0], imageDataUrl: '', imageFile: null, originalImage: '', coordinates: { lat: '', lng: '' }, visibility: 'private', device: { type: 'api', deviceId: '' } })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const [deletedHive, setDeletedHive] = useState(null)
  const undoTimerRef = useRef(null)

  const openAddModal = () => {
    setModalMode('add')
    setForm({ id: '', name: '', location: '', color: colors[0], imageDataUrl: '', imageFile: null, originalImage: '', coordinates: { lat: '', lng: '' }, visibility: 'private', device: { type: 'api', deviceId: '' } })
    setShowModal(true)
  }

  const openEditModal = (hive) => {
    setModalMode('edit')
    setForm({
      id: hive.id,
      name: hive.name || '',
      location: hive.location || '',
      color: hive.color || 'var(--warning)',
      imageDataUrl: hive.image || '',  // Store existing image URL
      imageFile: null,  // Track if user selected a new file
      originalImage: hive.image || '',  // Track original to detect changes
      coordinates: hive.coordinates || { lat: '', lng: '' },
      visibility: hive.visibility || 'private',
      device: hive.device || { type: 'api', deviceId: '' }
    })
    setShowModal(true)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    // Validate type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'Prosím nahraj obrázok (jpg, png, ...).' }))
      return
    }
    
    setErrors(prev => ({ ...prev, image: null }))
    
    // Compress image before processing
    const compressedFile = await compressImage(file, 2)
    
    // Check size after compression (4MB limit for Vercel)
    if (compressedFile.size > 4 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Obrázok je príliš veľký aj po kompresii (max 4 MB).' }))
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => setForm(prev => ({ ...prev, imageDataUrl: reader.result, imageFile: compressedFile }))
    reader.readAsDataURL(compressedFile)
  }

  const validateForm = () => {
    const e = {}
    if (!form.name || form.name.trim().length === 0) e.name = 'Názov je povinný.'
    if (form.coordinates?.lat && isNaN(parseFloat(form.coordinates.lat))) e.coordinates = 'Lat musí byť číslo.'
    if (form.coordinates?.lng && isNaN(parseFloat(form.coordinates.lng))) e.coordinates = 'Lng musí byť číslo.'
    setErrors(e)
    return Object.keys(e).length === 0
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
    
    // Use comprehensive validation
    if (!validateForm()) {
      // Show specific validation errors
      if (errors.name) toast.warning(errors.name)
      else if (errors.coordinates) toast.warning(errors.coordinates)
      else toast.warning('Skontroluj vyplnené údaje')
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
        // Stay on my-hives page instead of redirecting to inspection

        // Prepare payload; use FormData if imageFile present
        let res
        if (form.imageFile) {
          const fd = new FormData()
          fd.append('image', form.imageFile)
          fd.append('name', form.name)
          fd.append('location', form.location)
          fd.append('color', form.color)
          fd.append('visibility', form.visibility)
          const deviceData = { type: form.device.type }
          if (form.device.deviceId?.trim()) deviceData.deviceId = form.device.deviceId.trim()
          fd.append('device', JSON.stringify(deviceData))
          if (form.coordinates?.lat && form.coordinates?.lng) fd.append('coordinates', JSON.stringify({ lat: parseFloat(form.coordinates.lat), lng: parseFloat(form.coordinates.lng) }))

          res = await fetch('/api/users/me/hives', {
            method: 'POST',
            credentials: 'include',
            body: fd
          })
        } else {
          const hiveData = { name: form.name, location: form.location, color: form.color, visibility: form.visibility, device: { type: form.device.type } }
          if (form.coordinates?.lat && form.coordinates?.lng) hiveData.coordinates = { lat: parseFloat(form.coordinates.lat), lng: parseFloat(form.coordinates.lng) }
          if (form.imageDataUrl) hiveData.image = form.imageDataUrl

          res = await fetch('/api/users/me/hives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(hiveData)
          })
        }

        if (res.ok) {
          const created = await res.json().catch(() => null)
          
          // refreshUser() will trigger HiveContext to sync from user.ownedHives
          // which now includes the new hive with proper Cloudinary image URL
          await refreshUser()
          
          // After refreshUser, hives are already synced from backend
          // Just set the selected hive to the newly created one
          if (created?.hive?.id) {
            setSelectedHive(created.hive.id)
          } else if (created?.id) {
            setSelectedHive(created.id)
          }
          
          // If API hive, show the generated API key in a special toast
          if (created?.hive?.device?.apiKey) {
            toast.success(`Úľ "${form.name}" bol vytvorený. API kľúč: ${created.hive.device.apiKey}`, { duration: 8000 })
            toast.info('💡 Tip: API kľúč nájdete kedykoľvek v úprave úľa (kliknite na úľ)', { duration: 6000 })
          } else {
            toast.success(`Úľ "${form.name}" bol vytvorený`)
          }
        } else {
          const err = await res.json().catch(() => ({ message: 'Neznáma chyba' }))
          deleteHive(tempId)
          toast.error(`Chyba: ${err.message}`)
        }
      } else if (modalMode === 'edit') {
        const hiveId = form.id
        const wasManual = !form.device.apiKey && form.device.type === 'api' // Switching to API
        
        // Don't close modal yet if we're switching to API - we want to show the key
        if (!wasManual) {
          updateHive(hiveId, { name: form.name, location: form.location, color: form.color, image: form.imageDataUrl, coordinates: form.coordinates, visibility: form.visibility, device: form.device })
          setShowModal(false)
        }

        // PATCH: use FormData if imageFile present
        let res
        if (form.imageFile) {
          const fd = new FormData()
          fd.append('image', form.imageFile)
          fd.append('name', form.name)
          fd.append('location', form.location)
          fd.append('color', form.color)
          fd.append('visibility', form.visibility)
          const deviceData = { type: form.device.type }
          if (form.device.deviceId?.trim()) deviceData.deviceId = form.device.deviceId.trim()
          fd.append('device', JSON.stringify(deviceData))
          if (form.coordinates?.lat && form.coordinates?.lng) fd.append('coordinates', JSON.stringify({ lat: parseFloat(form.coordinates.lat), lng: parseFloat(form.coordinates.lng) }))

          res = await fetch(`/api/users/me/hives/${hiveId}`, {
            method: 'PATCH',
            credentials: 'include',
            body: fd
          })
        } else {
          const hiveData = { name: form.name, location: form.location, color: form.color, visibility: form.visibility, device: { type: form.device.type } }
          if (form.coordinates?.lat && form.coordinates?.lng) hiveData.coordinates = { lat: parseFloat(form.coordinates.lat), lng: parseFloat(form.coordinates.lng) }
          
          // Only send image if it actually changed (new base64 data URL, not the same URL)
          const imageChanged = form.imageDataUrl && form.imageDataUrl !== form.originalImage
          if (imageChanged) {
            hiveData.image = form.imageDataUrl
          }

          res = await fetch(`/api/users/me/hives/${hiveId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(hiveData)
          })
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          
          // refreshUser() will trigger HiveContext to sync from user.ownedHives
          // which now includes the updated hive with proper Cloudinary image URL
          await refreshUser()
          
          // If API key was generated (switched to API type), update form and show it
          if (data.hive?.device?.apiKey && wasManual) {
            setForm(f => ({ ...f, device: { ...f.device, apiKey: data.hive.device.apiKey } }))
            toast.success(`API kľúč vygenerovaný: ${data.hive.device.apiKey}`, { duration: 10000 })
            toast.info('💡 Skopírujte si kľúč alebo ho nájdete v úprave úľa', { duration: 6000 })
            // Keep modal open so user can copy the key
          } else {
            setShowModal(false)
            toast.success('Úľ upravený')
          }
          // After refreshUser, hives are already synced from backend - no need to updateHive
        } else {
          const err = await res.json().catch(() => ({ message: 'Neznáma chyba' }))
          toast.error(`Chyba: ${err.message || 'Neznáma chyba'}`)
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
          <div className="hive-card" key={h.id} style={{ '--hive-color': h.color || 'var(--primary)' }}>
            <div className="hive-image" style={{ backgroundColor: h.color || 'var(--card-bg)' }}>
              {h.image ? (
                <img src={h.image} alt={h.name || 'úl'} className="hive-image-el" />
              ) : (
                <div className="hive-initial">{(h.name || '').charAt(0) || 'U'}</div>
              )}
              {h.device?.type === 'api' && (
                <span className="device-badge api-badge" title="API zariadenie - kliknite ✏️ pre API kľúč">📡</span>
              )}
            </div>
            <div className="hive-body">
              <div className="hive-name">{h.name}</div>
              {h.location && <div className="hive-location">{h.location}</div>}
              <div className="hive-actions">
                <button className="btn btn-sm" onClick={() => goTo(h.id, '/history')}>📊 História</button>
                <button className="btn btn-sm" onClick={() => goTo(h.id, '/inspection')}>✅ Kontroly</button>
                <button className="btn btn-sm" onClick={() => goTo(h.id, '/harvests')}>🍯 Zbery</button>
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
            <h3>
              <span>{modalMode === 'add' ? '➕ Pridať úľ' : '✏️ Upraviť úľ'}</span>
              <button className="modal-close" type="button" onClick={() => setShowModal(false)} aria-label="Zatvoriť">✖</button>
            </h3>
            <form onSubmit={handleSave} className="modal-form">
              <label>Názov *</label>
              <input 
                value={form.name} 
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(err => ({ ...err, name: null })) }} 
                className={errors.name ? 'input-error' : ''}
              />
              {errors.name && <div className="error-text">{errors.name}</div>}

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
                {errors.image && <div className="error-text">{errors.image}</div>}
                {form.imageDataUrl && <img src={form.imageDataUrl} alt="preview" className="image-preview" />}

                <label>GPS súradnice (voliteľné)</label>
                <div className="gps-inputs">
                  <input 
                    placeholder="lat" 
                    value={form.coordinates.lat} 
                    onChange={e => { setForm(f => ({ ...f, coordinates: { ...f.coordinates, lat: e.target.value } })); setErrors(err => ({ ...err, coordinates: null })) }} 
                    className={errors.coordinates ? 'input-error' : ''}
                  />
                  <input 
                    placeholder="lng" 
                    value={form.coordinates.lng} 
                    onChange={e => { setForm(f => ({ ...f, coordinates: { ...f.coordinates, lng: e.target.value } })); setErrors(err => ({ ...err, coordinates: null })) }}
                    className={errors.coordinates ? 'input-error' : ''}
                  />
                  <button type="button" className="btn" onClick={getCurrentLocation}>📍 GPS</button>
                </div>
                {errors.coordinates && <div className="error-text">{errors.coordinates}</div>}

                <label>Zariadenie</label>
                <div className="api-key-section">
                    <label>API Kľúč</label>
                    {form.device.apiKey ? (
                      <>
                        <div className="api-key-display">
                          <code className="api-key-code">{form.device.apiKey}</code>
                          <button type="button" className="btn btn-sm" onClick={() => {
                            navigator.clipboard.writeText(form.device.apiKey)
                            toast.success('API kľúč skopírovaný!')
                          }}>📋 Kopírovať</button>
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm regenerate-btn"
                          onClick={async () => {
                            if (!confirm('Naozaj chcete vygenerovať nový API kľúč? Starý kľúč prestane fungovať!')) return
                            try {
                              const res = await fetch(`/api/users/me/hives/${form.id}/generate-api-key`, {
                                method: 'POST',
                                credentials: 'include'
                              })
                              const data = await res.json()
                              if (data.success) {
                                setForm(f => ({ ...f, device: { ...f.device, apiKey: data.apiKey } }))
                                await refreshUser()
                                toast.success('Nový API kľúč vygenerovaný!')
                              } else {
                                toast.error(data.error || 'Chyba pri generovaní')
                              }
                            } catch (err) {
                              toast.error('Chyba pripojenia')
                            }
                          }}
                        >
                          🔄 Vygenerovať nový kľúč
                        </button>
                        <small className="field-hint">Použite tento kľúč v hlavičke X-API-Key pri POST na /api/sensor</small>
                      </>
                    ) : (
                      <div className="no-api-key">
                        <div className="api-key-pending">
                          <span>🔑</span>
                          <div>
                            <strong>API kľúč bude automaticky vygenerovaný</strong>
                            <small>Kliknite "Uložiť" pre vytvorenie kľúča</small>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

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
