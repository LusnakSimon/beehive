import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Profile.css'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (!user) {
    return (
      <div className="profile-container">
        <div className="profile-card">
          <p>Nie si prihlásený</p>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          {user.image && (
            <img 
              src={user.image} 
              alt={user.name} 
              className="profile-avatar"
            />
          )}
          <h1>{user.name}</h1>
          <p className="profile-email">{user.email}</p>
        </div>

        <div className="profile-info">
          <div className="info-item">
            <span className="info-label">Provider</span>
            <span className="info-value">{user.provider || 'N/A'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Rola</span>
            <span className="info-value">{user.role === 'admin' ? 'Administrátor' : 'Používateľ'}</span>
          </div>
          {user.ownedHives && user.ownedHives.length > 0 && (
            <div className="info-item">
              <span className="info-label">Moje úle</span>
              <span className="info-value">
                {user.ownedHives.map(h => {
                  // Handle both old format (string) and new format (object)
                  if (typeof h === 'string') {
                    return h;
                  }
                  return `${h.name} (${h.id})`;
                }).join(', ')}
              </span>
            </div>
          )}
        </div>

        <button onClick={handleLogout} className="profile-logout-btn">
          <span className="icon">🚪</span>
          <span>Odhlásiť sa</span>
        </button>
      </div>
    </div>
  )
}
