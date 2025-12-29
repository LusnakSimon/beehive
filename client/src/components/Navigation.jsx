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
  const navDesktopRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(10)
  const [showDesktopMore, setShowDesktopMore] = useState(false)

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

  // Adjust how many desktop nav items fit and move remainder into the 'More' dropdown
  useEffect(() => {
    const el = navDesktopRef.current
    if (!el) return

    const calculate = () => {
      const first = el.querySelector('.nav-link')
      const itemWidth = first ? Math.max(80, first.offsetWidth) : 100
      const available = Math.floor(el.clientWidth / itemWidth)
      const maxVisible = Math.max(1, Math.min(12, available))
      setVisibleCount(maxVisible)
    }

    // Initial calculation
    calculate()

    const ro = new ResizeObserver(() => calculate())
    ro.observe(el)
    window.addEventListener('resize', calculate)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', calculate)
    }
  }, [totalUnread, notificationUnread, user?.role])
  
  return (
    <nav className="navigation">
      {isAuthenticated ? (
        <>
          {/* Desktop Navigation - responsive with overflow 'More' menu */}
          <div className="nav-desktop" ref={navDesktopRef}>
            {(() => {
              // Define nav items in priority order
              const items = [
                { key: 'dashboard', to: '/', icon: '🏠', label: 'Dashboard' },
                  { key: 'my-hives', to: '/my-hives', icon: '🐝', label: 'Moje úle' },
                { key: 'history', to: '/history', icon: '📊', label: 'História' },
                { key: 'inspection', to: '/inspection', icon: '📋', label: 'Kontrola' },
                { key: 'map', to: '/map', icon: '🗺️', label: 'Mapa' },
                { key: 'search', to: '/search', icon: '🔍', label: 'Hľadať' },
                { key: 'friends', to: '/friends', icon: '👫', label: 'Priatelia' },
                { key: 'messages', to: '/messages', icon: '💬', label: 'Správy', badge: totalUnread },
                { key: 'groups', to: '/groups', icon: '👥', label: 'Skupiny' },
                { key: 'notifications', to: '/notifications', icon: '🔔', label: 'Upozornenia', badge: notificationUnread },
                { key: 'settings', to: '/settings', icon: '⚙️', label: 'Nastavenia' }
              ]

              if (user?.role === 'admin') {
                items.push({ key: 'admin', to: '/admin', icon: '🔧', label: 'Admin' })
              }

              // Determine visible / overflow based on visibleCount
              const visible = items.slice(0, visibleCount)
              const overflow = items.slice(visibleCount)

              return (
                <>
                  {visible.map(it => (
                    <NavLink key={it.key} to={it.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                      <span className="icon">{it.icon}</span>
                      <span>{it.label}</span>
                      {it.badge > 0 && <span className="nav-badge">{it.badge}</span>}
                    </NavLink>
                  ))}

                  {overflow.length > 0 && (
                    <div className="nav-more-desktop">
                      <button
                        className={`nav-link ${showDesktopMore ? 'active' : ''}`}
                        onClick={() => setShowDesktopMore(s => !s)}
                        aria-expanded={showDesktopMore}
                        aria-haspopup="true"
                        aria-label="More navigation items"
                      >
                        <span className="icon">⋯</span>
                        <span>Viac</span>
                      </button>

                      {showDesktopMore && (
                        <div className="desktop-dropdown">
                          {overflow.map(it => (
                            <NavLink key={it.key} to={it.to} className="desktop-dropdown-item" onClick={() => setShowDesktopMore(false)}>
                              <span className="icon">{it.icon}</span>
                              <span>{it.label}</span>
                              {it.badge > 0 && <span className="nav-badge">{it.badge}</span>}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
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
                aria-expanded={showMobileMenu}
                aria-haspopup="true"
                aria-label="Zobraziť viac možností"
              >
                <span className="icon" aria-hidden="true">⋯</span>
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
            <NavLink to="/profile" className="nav-user-info nav-profile-link" aria-label="Zobraziť profil">
              {user?.image && <img src={user.image} alt="" className="nav-avatar" aria-hidden="true" />}
              <span className="nav-username">{user?.name}</span>
            </NavLink>
            <button onClick={logout} className="nav-logout-btn" aria-label="Odhlásiť sa">
              <span className="icon" aria-hidden="true">🚪</span>
            </button>
          </div>
        </>
      ) : (
        <NavLink to="/login" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon" aria-hidden="true">🔑</span>
          <span>Prihlásenie</span>
        </NavLink>
      )}
    </nav>
  )
}
