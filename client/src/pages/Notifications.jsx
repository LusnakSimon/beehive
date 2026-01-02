import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Notifications.css'

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/social-notifications?limit=100', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch notifications')
      const data = await response.json()
      setNotifications(data.notifications || [])
      setError('')
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError('Nepodarilo sa načítať upozornenia')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Listen for custom event to refresh
    const handleRefresh = () => fetchNotifications()
    window.addEventListener('notificationsRead', handleRefresh)
    return () => window.removeEventListener('notificationsRead', handleRefresh)
  }, [])

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/social-notifications/${notificationId}/read`, {
        method: 'PATCH',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to mark as read')
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      )
      
      // Dispatch event to update badge in Navigation
      window.dispatchEvent(new Event('notificationsRead'))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/social-notifications/mark-all-read', {
        method: 'PATCH',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to mark all as read')
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      
      // Dispatch event to update badge
      window.dispatchEvent(new Event('notificationsRead'))
    } catch (err) {
      console.error('Error marking all as read:', err)
      setError('Nepodarilo sa označiť všetky ako prečítané')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`/api/social-notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to delete notification')
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
      
      // Dispatch event to update badge
      window.dispatchEvent(new Event('notificationsRead'))
    } catch (err) {
      console.error('Error deleting notification:', err)
      setError('Nepodarilo sa vymazať upozornenie')
    }
  }

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification._id)
    }

    // Navigate based on type
    if (notification.link) {
      navigate(notification.link)
    } else {
      // Fallback navigation
      if (notification.type === 'friend_request') {
        navigate('/search') // Friend requests are in search page
      } else if (notification.type === 'friend_request_accepted') {
        navigate(`/profile/${notification.from._id}`)
      } else if (notification.type === 'new_message' && notification.content.conversationId) {
        navigate(`/chat/${notification.content.conversationId}`)
      } else if (notification.type === 'group_message' && notification.content.groupId) {
        navigate(`/groups/${notification.content?.groupId}/chat`)
      }
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request':
        return '👥'
      case 'friend_request_accepted':
        return '✅'
      case 'new_message':
        return '💬'
      case 'group_message':
        return '👥💬'
      default:
        return '🔔'
    }
  }

  const getDefaultNotificationText = (notification) => {
    const fromName = notification.from?.name || 'Niekto'
    switch (notification.type) {
      case 'friend_request':
        return `${fromName} vám poslal žiadosť o priateľstvo`
      case 'friend_request_accepted':
        return `${fromName} prijal vašu žiadosť o priateľstvo`
      case 'new_message':
        return `${fromName} vám poslal správu`
      case 'group_message':
        return `${fromName} poslal správu do skupiny`
      default:
        return 'Nové upozornenie'
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Teraz'
    if (diffMins < 60) return `Pred ${diffMins} min`
    if (diffHours < 24) return `Pred ${diffHours} h`
    if (diffDays < 7) return `Pred ${diffDays} d`
    return date.toLocaleDateString('sk-SK')
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="notifications-page">
        <div className="notifications-loading">
          <span className="loading-spinner">⏳</span>
          <p>Načítavam upozornenia...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1>Upozornenia</h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="mark-all-btn">
            <span className="icon">✓</span>
            Označiť všetky ako prečítané ({unreadCount})
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="icon">⚠️</span>
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <span className="empty-icon">🔔</span>
          <h2>Žiadne upozornenia</h2>
          <p>Tu sa zobrazia upozornenia o priateľských žiadostiach a správach</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notification => (
            <div 
              key={notification._id}
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className="notification-content">
                <div className="notification-header-row">
                  {notification.from?.image && (
                    <img 
                      src={notification.from.image} 
                      alt={notification.from?.name || 'User'}
                      className="notification-avatar"
                    />
                  )}
                  <div className="notification-text">
                    <p className="notification-message">
                      {notification.content?.text || getDefaultNotificationText(notification)}
                    </p>
                    <span className="notification-time">
                      {formatTimestamp(notification.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="notification-actions">
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      markAsRead(notification._id)
                    }}
                    className="action-btn mark-read-btn"
                    title="Označiť ako prečítané"
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNotification(notification._id)
                  }}
                  className="action-btn delete-btn"
                  title="Vymazať upozornenie"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
