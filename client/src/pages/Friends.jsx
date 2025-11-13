import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Friends.css'

export default function Friends() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchFriends()
  }, [])

  const fetchFriends = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/friends', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setFriends(data.friends || [])
      }
    } catch (err) {
      console.error('Error fetching friends:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.profile?.location?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="friends-page">
      <div className="friends-container">
        <div className="friends-header">
          <h1>Priatelia ({friends.length})</h1>
          <button 
            onClick={() => navigate('/friends/requests')}
            className="btn-requests"
          >
            📬 Žiadosti
          </button>
        </div>

        {friends.length > 0 && (
          <div className="search-box">
            <input
              type="text"
              placeholder="Hľadať priateľov..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
        )}

        {loading ? (
          <div className="loading">Načítavam priateľov...</div>
        ) : friends.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <h3>Zatiaľ nemáte žiadnych priateľov</h3>
            <p>
              Začnite pridávať priateľov prehliadaním máp úľov a návštevou ich profilov.
            </p>
            <div className="empty-actions">
              <button 
                onClick={() => navigate('/map')}
                className="btn-primary"
              >
                🗺️ Prejsť na mapu
              </button>
              <button 
                onClick={() => navigate('/friends/requests')}
                className="btn-secondary"
              >
                📬 Pozrieť žiadosti
              </button>
            </div>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <h3>Nenašli sa žiadni priatelia</h3>
            <p>Skúste iný vyhľadávací výraz.</p>
          </div>
        ) : (
          <div className="friends-grid">
            {filteredFriends.map((friend) => {
              const avatarUrl = friend.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name)}&background=fbbf24&color=fff&size=128`

              return (
                <div 
                  key={friend._id} 
                  className="friend-card"
                >
                  <div 
                    className="friend-card-content"
                    onClick={() => navigate(`/profile/${friend._id}`)}
                  >
                    <img
                      src={avatarUrl}
                      alt={friend.name}
                      className="friend-avatar"
                    />
                    
                    <div className="friend-info">
                      <h3>{friend.name}</h3>
                      
                      {friend.profile?.location && (
                        <p className="friend-location">
                          📍 {friend.profile.location}
                        </p>
                      )}
                      
                      {friend.profile?.experienceYears > 0 && (
                        <p className="friend-experience">
                          🐝 {friend.profile.experienceYears} rokov skúseností
                        </p>
                      )}

                      {friend.profile?.bio && (
                        <p className="friend-bio">{friend.profile.bio}</p>
                      )}
                    </div>

                    <div className="friend-stats">
                      <div className="friend-stat">
                        <span className="stat-value">{friend.stats?.totalHives || 0}</span>
                        <span className="stat-label">úľov</span>
                      </div>
                      <div className="friend-stat">
                        <span className="stat-value">{friend.stats?.friendsCount || 0}</span>
                        <span className="stat-label">priateľov</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    className="btn-message-friend"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        const response = await fetch('/api/conversations', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ userId: friend._id })
                        })
                        if (response.ok) {
                          const data = await response.json()
                          navigate(`/messages/${data.conversation.id}`)
                        }
                      } catch (err) {
                        console.error('Error creating conversation:', err)
                      }
                    }}
                  >
                    💬 Napísať správu
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
