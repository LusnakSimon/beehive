import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './FriendRequests.css'

export default function FriendRequests() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState('incoming')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    fetchRequests()
  }, [activeTab])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/friends/requests?type=${activeTab}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      }
    } catch (err) {
      console.error('Error fetching requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (requestId) => {
    setActionLoading(requestId)
    try {
      const response = await fetch(`/api/friends/requests/${requestId}/accept`, {
        method: 'PATCH',
        credentials: 'include'
      })

      if (response.ok) {
        await fetchRequests()
        alert('Friend request accepted!')
      }
    } catch (err) {
      console.error('Error accepting request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (requestId) => {
    setActionLoading(requestId)
    try {
      const response = await fetch(`/api/friends/requests/${requestId}/reject`, {
        method: 'PATCH',
        credentials: 'include'
      })

      if (response.ok) {
        await fetchRequests()
      }
    } catch (err) {
      console.error('Error rejecting request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (requestId) => {
    setActionLoading(requestId)
    try {
      const response = await fetch(`/api/friends/requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        await fetchRequests()
      }
    } catch (err) {
      console.error('Error cancelling request:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'práve teraz'
    if (diffMins < 60) return `pred ${diffMins} min`
    if (diffHours < 24) return `pred ${diffHours} h`
    if (diffDays < 7) return `pred ${diffDays} d`
    return date.toLocaleDateString('sk-SK')
  }

  return (
    <div className="friend-requests-page">
      <div className="friend-requests-container">
        <h1>Žiadosti o priateľstvo</h1>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'incoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('incoming')}
          >
            Prijaté ({requests.length})
          </button>
          <button
            className={`tab ${activeTab === 'outgoing' ? 'active' : ''}`}
            onClick={() => setActiveTab('outgoing')}
          >
            Odoslané
          </button>
        </div>

        {loading ? (
          <div className="loading">Načítavam žiadosti...</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              {activeTab === 'incoming' ? '📭' : '📤'}
            </span>
            <h3>
              {activeTab === 'incoming' 
                ? 'Žiadne nové žiadosti' 
                : 'Žiadne odoslané žiadosti'}
            </h3>
            <p>
              {activeTab === 'incoming'
                ? 'Tu sa zobrazia žiadosti o priateľstvo od ostatných používateľov.'
                : 'Tu sa zobrazia vaše odoslané žiadosti o priateľstvo.'}
            </p>
          </div>
        ) : (
          <div className="requests-list">
            {requests.map((request) => {
              const user = activeTab === 'incoming' ? request.from : request.to
              const avatarUrl = user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=fbbf24&color=fff&size=128`

              return (
                <div key={request._id} className="request-card">
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="request-avatar"
                    onClick={() => navigate(`/profile/${user._id}`)}
                  />
                  
                  <div className="request-info">
                    <h3 onClick={() => navigate(`/profile/${user._id}`)}>
                      {user.name}
                    </h3>
                    {user.profile?.location && (
                      <p className="request-location">📍 {user.profile.location}</p>
                    )}
                    {request.message && (
                      <p className="request-message">"{request.message}"</p>
                    )}
                    <span className="request-time">{formatDate(request.createdAt)}</span>
                  </div>

                  <div className="request-actions">
                    {activeTab === 'incoming' ? (
                      <>
                        <button
                          onClick={() => handleAccept(request._id)}
                          className="btn-accept"
                          disabled={actionLoading === request._id}
                        >
                          ✓ Prijať
                        </button>
                        <button
                          onClick={() => handleReject(request._id)}
                          className="btn-reject"
                          disabled={actionLoading === request._id}
                        >
                          ✕ Odmietnuť
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCancel(request._id)}
                        className="btn-cancel"
                        disabled={actionLoading === request._id}
                      >
                        Zrušiť
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
