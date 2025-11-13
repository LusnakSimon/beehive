import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { handleInAppNotification } from '../utils/pushNotifications'
import './Navigation.css'

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [totalUnread, setTotalUnread] = useState(0)
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const lastNotificationCheck = useRef(new Set())

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
      // Fetch unread count
      const countResponse = await fetch('/api/social-notifications/unread-count', {
        credentials: 'include'
      })
      
      if (countResponse.ok) {
        const countData = await countResponse.json()
        setNotificationUnread(countData.unreadCount || 0)
      }

      // Fetch recent unread notifications for push
      const notifResponse = await fetch('/api/social-notifications?limit=10&unreadOnly=true', {
        credentials: 'include'
      })
      
      if (notifResponse.ok) {
        const notifData = await notifResponse.json()
        
        // Show push notifications for new notifications
        notifData.notifications?.forEach(notification => {
          const notifId = notification._id || notification.id
          
          // Only show push if we haven't seen this notification yet
          if (!lastNotificationCheck.current.has(notifId)) {
            lastNotificationCheck.current.add(notifId)
            
            // Show push notification
            handleInAppNotification(notification, navigate)
          }
        })

        // Keep only recent 50 notification IDs in memory
        if (lastNotificationCheck.current.size > 50) {
          const arr = Array.from(lastNotificationCheck.current)
          lastNotificationCheck.current = new Set(arr.slice(-50))
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
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
        // Also update notification count since message notifications should be marked as read
        fetchNotificationCount()
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
            <NavLink to="/friends" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">👫</span>
              <span>Priatelia</span>
            </NavLink>
            <NavLink to="/messages" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">💬</span>
              <span>Správy</span>
              {totalUnread > 0 && <span className="nav-badge">{totalUnread}</span>}
            </NavLink>
            <NavLink to="/groups" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">👥</span>
              <span>Skupiny</span>
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
            <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">📜</span>
              <span>História</span>
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
                  <NavLink to="/inspection" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">📋</span>
                    <span>Kontrola</span>
                  </NavLink>
                  <NavLink to="/map" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">🗺️</span>
                    <span>Mapa</span>
                  </NavLink>
                  <NavLink to="/groups" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">👥</span>
                    <span>Skupiny</span>
                  </NavLink>
                  <NavLink to="/search" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">🔍</span>
                    <span>Hľadať</span>
                  </NavLink>
                  <NavLink to="/friends" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">👫</span>
                    <span>Priatelia</span>
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
            <button onClick={logout} className="nav-logout-btn" title="Odhlásiť sa">
              <span className="icon">🚪</span>
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
