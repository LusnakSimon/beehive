import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Messages.css'

export default function Messages() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchConversations, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'práve teraz'
    if (diffMins < 60) return `pred ${diffMins} min`
    if (diffHours < 24) return `pred ${diffHours} h`
    if (diffDays === 1) return 'včera'
    if (diffDays < 7) return `pred ${diffDays} dňami`
    return date.toLocaleDateString('sk-SK')
  }

  const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className="messages-header">
          <h1>💬 Správy</h1>
          {totalUnread > 0 && (
            <span className="total-unread-badge">{totalUnread}</span>
          )}
        </div>

        {loading ? (
          <div className="loading">Načítavam konverzácie...</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <h3>Žiadne správy</h3>
            <p>
              Začnite konverzáciu s priateľmi. Nájdite priateľov a napíšte im prvú správu!
            </p>
            <button 
              onClick={() => navigate('/friends')}
              className="btn-primary"
            >
              👥 Zobraziť priateľov
            </button>
          </div>
        ) : (
          <div className="conversations-list">
            {conversations.map((conv) => {
              const avatarUrl = conv.otherUser?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.otherUser?.name || 'User')}&background=fbbf24&color=fff&size=128`

              return (
                <div
                  key={conv.id}
                  className={`conversation-item ${conv.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                >
                  <div className="conversation-avatar-wrapper">
                    <img
                      src={avatarUrl}
                      alt={conv.otherUser?.name}
                      className="conversation-avatar"
                    />
                    {conv.unreadCount > 0 && (
                      <span className="unread-badge">{conv.unreadCount}</span>
                    )}
                  </div>

                  <div className="conversation-content">
                    <div className="conversation-top">
                      <h3 className="conversation-name">
                        {conv.otherUser?.name || 'Neznámy používateľ'}
                      </h3>
                      <span className="conversation-time">
                        {formatTime(conv.lastMessage?.timestamp || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="conversation-preview">
                      {conv.lastMessage ? (
                        <p className={conv.unreadCount > 0 ? 'unread-text' : ''}>
                          {conv.lastMessage.sender?.toString() === currentUser?.id ? 'Vy: ' : ''}
                          {conv.lastMessage.text}
                        </p>
                      ) : (
                        <p className="no-messages">Zatiaľ žiadne správy</p>
                      )}
                    </div>
                  </div>

                  <div className="conversation-arrow">›</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
