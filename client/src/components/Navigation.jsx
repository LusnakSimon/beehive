import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Navigation.css'

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth()
  
  return (
    <nav className="navigation">
      {isAuthenticated ? (
        <>
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="icon">🏠</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="icon">📊</span>
            <span>História</span>
          </NavLink>
          <NavLink to="/inspection" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="icon">📋</span>
            <span>Kontrola</span>
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="icon">🗺️</span>
            <span>Mapa</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="icon">⚙️</span>
            <span>Nastavenia</span>
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🔧</span>
              <span>Admin</span>
            </NavLink>
          )}
          {/* Desktop user section */}
          <div className="nav-user-section">
            <NavLink to="/profile" className="nav-user-info nav-profile-link">
              {user?.image && <img src={user.image} alt={user.name} className="nav-avatar" />}
              <span className="nav-username">{user?.name}</span>
            </NavLink>
            <button onClick={logout} className="nav-logout-btn">
              <span className="icon">🚪</span>
              <span>Odhlásiť</span>
            </button>
          </div>
          
          {/* Mobile user icon */}
          <div className="nav-user-mobile">
            <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {user?.image ? (
                <img src={user.image} alt={user.name} className="nav-avatar" style={{ width: '28px', height: '28px', margin: '0' }} />
              ) : (
                <span className="icon">👤</span>
              )}
              <span>Profil</span>
            </NavLink>
          </div>
        </>
      ) : (
        <NavLink to="/login" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon">🔑</span>
          <span>Prihlásenie</span>
        </NavLink>
      )}
    </nav>
  )
}
