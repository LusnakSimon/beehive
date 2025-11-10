import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './ProfileEdit.css'

export default function ProfileEdit() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    bio: '',
    location: '',
    experienceYears: 0,
    website: '',
    phone: '',
    isPublic: true,
    showEmail: false,
    showHiveLocations: true
  })
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        bio: user.profile.bio || '',
        location: user.profile.location || '',
        experienceYears: user.profile.experienceYears || 0,
        website: user.profile.website || '',
        phone: user.profile.phone || '',
        isPublic: user.profile.isPublic !== false,
        showEmail: user.profile.showEmail || false,
        showHiveLocations: user.profile.showHiveLocations !== false
      })
    }
  }, [user])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSuccess(false)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/users/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await refreshUser()
        setSuccess(true)
        setTimeout(() => {
          navigate('/profile')
        }, 1500)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update profile')
      }
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="profile-edit-page">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="profile-edit-page">
      <div className="profile-edit-container">
        <div className="profile-edit-header">
          <h1>✏️ Upraviť profil</h1>
          <button onClick={() => navigate('/profile')} className="btn-cancel">
            ← Späť na profil
          </button>
        </div>

        <form onSubmit={handleSubmit} className="profile-edit-form">
          {/* Basic Info */}
          <div className="form-section">
            <h2>Základné informácie</h2>
            
            <div className="form-group">
              <label htmlFor="bio">O mne</label>
              <textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="Napíš niečo o sebe..."
                maxLength={500}
                rows={5}
              />
              <small>{formData.bio.length}/500 znakov</small>
            </div>

            <div className="form-group">
              <label htmlFor="location">Lokalita</label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="napr. Žilina, Slovensko"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="experienceYears">Roky skúseností s včelárením</label>
              <input
                type="number"
                id="experienceYears"
                value={formData.experienceYears}
                onChange={(e) => handleChange('experienceYears', parseInt(e.target.value) || 0)}
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="form-section">
            <h2>Kontaktné informácie</h2>
            
            <div className="form-group">
              <label htmlFor="phone">Telefón (voliteľné)</label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+421 XXX XXX XXX"
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="website">Webová stránka (voliteľné)</label>
              <input
                type="url"
                id="website"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://..."
                maxLength={200}
              />
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="form-section">
            <h2>Nastavenia súkromia</h2>
            
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="isPublic"
                checked={formData.isPublic}
                onChange={(e) => handleChange('isPublic', e.target.checked)}
              />
              <label htmlFor="isPublic">
                <strong>Verejný profil</strong>
                <p>Umožní ostatným používateľom vidieť tvoj profil</p>
              </label>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="showEmail"
                checked={formData.showEmail}
                onChange={(e) => handleChange('showEmail', e.target.checked)}
              />
              <label htmlFor="showEmail">
                <strong>Zobraziť emailovú adresu</strong>
                <p>Tvoj email bude viditeľný na profile</p>
              </label>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="showHiveLocations"
                checked={formData.showHiveLocations}
                onChange={(e) => handleChange('showHiveLocations', e.target.checked)}
              />
              <label htmlFor="showHiveLocations">
                <strong>Zobraziť GPS súradnice úľov</strong>
                <p>Presné súradnice tvojich úľov budú viditeľné ostatným</p>
              </label>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              ✅ Profil úspešne aktualizovaný! Presmerovanie...
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="btn-secondary"
              disabled={saving}
            >
              Zrušiť
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Ukladám...' : 'Uložiť zmeny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
