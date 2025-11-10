import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Profile.css'

export default function Profile() {
  const { userId } = useParams()
  const { user: currentUser, logout } = useAuth()
  const navigate = useNavigate()
  
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hives, setHives] = useState([])
  
  const isOwnProfile = currentUser && (!userId || userId === currentUser.id)

  useEffect(() => {
    fetchProfile()
  }, [userId, currentUser])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const targetUserId = userId || currentUser?.id
      if (!targetUserId) {
        setError('User not found')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/users/${targetUserId}/profile`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        setHives(data.hives || [])
      } else if (response.status === 404) {
        setError('User not found')
      } else if (response.status === 403) {
        setError('This profile is private')
      } else {
        setError('Failed to load profile')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">Loading profile...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="error-message">
          <h2>⚠️ {error}</h2>
          <button onClick={() => navigate('/')} className="btn-primary">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const publicHivesCount = hives.filter(h => h.visibility === 'public').length

  return (
    <div className="profile-page">
      {/* Cover Photo */}
      <div 
        className="profile-cover"
        style={{
          backgroundImage: profile.profile?.coverPhoto 
            ? `url(${profile.profile.coverPhoto})` 
            : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
        }}
      />

      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <img
              src={profile.image || profile.profile?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=fbbf24&color=fff&size=200`}
              alt={profile.name}
              className="profile-avatar"
            />
          </div>

          <div className="profile-info">
            <h1>{profile.name}</h1>
            {profile.profile?.location && (
              <p className="profile-location">📍 {profile.profile.location}</p>
            )}
            {profile.profile?.experienceYears > 0 && (
              <p className="profile-experience">
                🐝 {profile.profile.experienceYears} {profile.profile.experienceYears === 1 ? 'rok' : profile.profile.experienceYears < 5 ? 'roky' : 'rokov'} skúseností
              </p>
            )}
          </div>

          <div className="profile-actions">
            {isOwnProfile ? (
              <>
                <button 
                  onClick={() => navigate('/profile/edit')}
                  className="btn-edit-profile"
                >
                  ✏️ Upraviť profil
                </button>
                <button onClick={handleLogout} className="btn-logout">
                  🚪 Odhlásiť sa
                </button>
              </>
            ) : (
              <>
                <button className="btn-add-friend" disabled>
                  👥 Pridať priateľa
                </button>
                <button className="btn-message" disabled>
                  💬 Napísať
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-value">{profile.stats?.totalHives || hives.length || 0}</span>
            <span className="stat-label">Všetky úle</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{publicHivesCount}</span>
            <span className="stat-label">Verejné úle</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{profile.stats?.friendsCount || 0}</span>
            <span className="stat-label">Priatelia</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{profile.stats?.groupsCount || 0}</span>
            <span className="stat-label">Skupiny</span>
          </div>
        </div>

        {/* Bio */}
        {profile.profile?.bio && (
          <div className="profile-section">
            <h2>O mne</h2>
            <p className="profile-bio">{profile.profile.bio}</p>
          </div>
        )}

        {/* Contact Info */}
        {(profile.profile?.showEmail || profile.profile?.phone || profile.profile?.website) && (
          <div className="profile-section">
            <h2>Kontakt</h2>
            <div className="contact-info">
              {profile.profile?.showEmail && profile.email && (
                <div className="contact-item">
                  <span className="contact-icon">📧</span>
                  <a href={`mailto:${profile.email}`}>{profile.email}</a>
                </div>
              )}
              {profile.profile?.phone && (
                <div className="contact-item">
                  <span className="contact-icon">📱</span>
                  <a href={`tel:${profile.profile.phone}`}>{profile.profile.phone}</a>
                </div>
              )}
              {profile.profile?.website && (
                <div className="contact-item">
                  <span className="contact-icon">🌐</span>
                  <a href={profile.profile.website} target="_blank" rel="noopener noreferrer">
                    {profile.profile.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hives */}
        {hives.length > 0 && (
          <div className="profile-section">
            <h2>Úle ({hives.length})</h2>
            <div className="hives-grid">
              {hives.map(hive => (
                <div key={hive.id} className="hive-card">
                  <div 
                    className="hive-card-icon"
                    style={{ backgroundColor: hive.color || '#fbbf24' }}
                  >
                    🐝
                  </div>
                  <div className="hive-card-info">
                    <h3>{hive.name}</h3>
                    <p className="hive-card-id">{hive.id}</p>
                    {hive.location && (
                      <p className="hive-card-location">📍 {hive.location}</p>
                    )}
                    {hive.coordinates && (profile.profile?.showHiveLocations || isOwnProfile) && (
                      <p className="hive-card-coords">
                        GPS: {hive.coordinates.lat.toFixed(4)}, {hive.coordinates.lng.toFixed(4)}
                      </p>
                    )}
                    <span className={`hive-visibility ${hive.visibility || 'private'}`}>
                      {hive.visibility === 'public' ? '🌍 Verejný' : '🔒 Súkromný'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Member Since */}
        <div className="profile-footer">
          <p>Člen od {new Date(profile.createdAt).toLocaleDateString('sk-SK')}</p>
        </div>
      </div>
    </div>
  )
}
