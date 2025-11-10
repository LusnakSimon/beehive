import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Navigation.css'

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth()
  const [totalUnread, setTotalUnread] = useState(0)
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return
    
    try {
      const response = await fetch('/api/conversations', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const total = data.conversations.reduce((sum, conv) => sum + conv.unreadCount, 0)
        setTotalUnread(total)
      }
    } catch (err) {
      console.error('Error fetching unread count:', err)
    }
  }

  const fetchNotificationCount = async () => {
    if (!isAuthenticated) return
    
    try {
      const response = await fetch('/api/social-notifications/unread-count', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setNotificationUnread(data.unreadCount || 0)
      }
    } catch (err) {
      console.error('Error fetching notification count:', err)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount()
      fetchNotificationCount()
      
      // Poll for new messages every 30 seconds
      const interval = setInterval(() => {
        fetchUnreadCount()
        fetchNotificationCount()
      }, 30000)
      
      // Listen for custom event when messages are read
      const handleMessagesRead = () => {
        fetchUnreadCount()
      }
      const handleNotificationsRead = () => {
        fetchNotificationCount()
      }
      window.addEventListener('messagesRead', handleMessagesRead)
      window.addEventListener('notificationsRead', handleNotificationsRead)
      
      return () => {
        clearInterval(interval)
        window.removeEventListener('messagesRead', handleMessagesRead)
        window.removeEventListener('notificationsRead', handleNotificationsRead)
      }
    }
  }, [isAuthenticated])
  
  return (
    <nav className="navigation">
      {isAuthenticated ? (
        <>
          {/* Desktop Navigation - All items */}
          <div className="nav-desktop">
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
            <NavLink to="/search" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🔍</span>
              <span>Hľadať</span>
            </NavLink>
            <NavLink to="/messages" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">💬</span>
              <span>Správy</span>
              {totalUnread > 0 && <span className="nav-badge">{totalUnread}</span>}
            </NavLink>
            <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🔔</span>
              <span>Upozornenia</span>
              {notificationUnread > 0 && <span className="nav-badge">{notificationUnread}</span>}
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
          </div>

          {/* Mobile Navigation - Core items only */}
          <div className="nav-mobile">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🏠</span>
              <span>Domov</span>
            </NavLink>
            <NavLink to="/map" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🗺️</span>
              <span>Mapa</span>
            </NavLink>
            <NavLink to="/messages" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">💬</span>
              <span>Správy</span>
              {totalUnread > 0 && <span className="nav-badge">{totalUnread}</span>}
            </NavLink>
            <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🔔</span>
              <span>Notif.</span>
              {notificationUnread > 0 && <span className="nav-badge">{notificationUnread}</span>}
            </NavLink>
            <div className="nav-more">
              <button 
                className={`nav-link ${showMobileMenu ? 'active' : ''}`}
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <span className="icon">⋯</span>
                <span>Viac</span>
              </button>
              {showMobileMenu && (
                <div className="mobile-dropdown">
                  <NavLink to="/history" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">📊</span>
                    <span>História</span>
                  </NavLink>
                  <NavLink to="/inspection" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">📋</span>
                    <span>Kontrola</span>
                  </NavLink>
                  <NavLink to="/search" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">🔍</span>
                    <span>Hľadať</span>
                  </NavLink>
                  <NavLink to="/settings" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">⚙️</span>
                    <span>Nastavenia</span>
                  </NavLink>
                  <NavLink to="/profile" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">👤</span>
                    <span>Profil</span>
                  </NavLink>
                  {user?.role === 'admin' && (
                    <NavLink to="/admin" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                      <span className="icon">🔧</span>
                      <span>Admin</span>
                    </NavLink>
                  )}
                  <button className="mobile-dropdown-item logout-item" onClick={() => { logout(); setShowMobileMenu(false); }}>
                    <span className="icon">🚪</span>
                    <span>Odhlásiť sa</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Desktop user section */}
          <div className="nav-user-section">
            <NavLink to="/profile" className="nav-user-info nav-profile-link">
              {user?.image && <img src={user.image} alt={user.name} className="nav-avatar" />}
              <span className="nav-username">{user?.name}</span>
            </NavLink>
            <button onClick={logout} className="nav-logout-btn">
              <span className="icon">�</span>
              <span>Odhlásiť</span>
            </button>
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
