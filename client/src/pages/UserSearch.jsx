import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './UserSearch.css'

export default function UserSearch() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [minExperience, setMinExperience] = useState(0)
  const [maxExperience, setMaxExperience] = useState(100)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    // Initial load - show some users
    searchUsers()
  }, [])

  const searchUsers = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        q: searchQuery,
        location: locationFilter,
        minExperience: minExperience.toString(),
        maxExperience: maxExperience.toString(),
        limit: '50'
      })

      const response = await fetch(`/api/users/search?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Error searching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    searchUsers()
  }

  const resetFilters = () => {
    setSearchQuery('')
    setLocationFilter('')
    setMinExperience(0)
    setMaxExperience(100)
  }

  return (
    <div className="search-page">
      <div className="search-container">
        <h1>🔍 Hľadať včelárov</h1>

        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Hľadať podľa mena..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn-search">
              Hľadať
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="btn-toggle-filters"
          >
            {showFilters ? '▲' : '▼'} Filtre
          </button>

          {showFilters && (
            <div className="filters">
              <div className="filter-group">
                <label>Lokalita</label>
                <input
                  type="text"
                  placeholder="napr. Bratislava, Košice..."
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label>Skúsenosti (roky)</label>
                <div className="range-inputs">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={minExperience}
                    onChange={(e) => setMinExperience(parseInt(e.target.value) || 0)}
                    className="range-input"
                    placeholder="Min"
                  />
                  <span>až</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(parseInt(e.target.value) || 100)}
                    className="range-input"
                    placeholder="Max"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="btn-reset"
              >
                Vymazať filtre
              </button>
            </div>
          )}
        </form>

        {loading ? (
          <div className="loading">Hľadám...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <h3>Nenašli sa žiadni používatelia</h3>
            <p>Skúste zmeniť vyhľadávacie kritériá alebo filtre.</p>
          </div>
        ) : (
          <>
            <div className="results-count">
              Nájdených: <strong>{users.length}</strong> používateľov
            </div>
            
            <div className="users-grid">
              {users.map((user) => {
                const avatarUrl = user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=fbbf24&color=fff&size=128`

                return (
                  <div 
                    key={user.id} 
                    className="user-card"
                  >
                    <img
                      src={avatarUrl}
                      alt={user.name}
                      className="user-avatar"
                      onClick={() => navigate(`/profile/${user.id}`)}
                    />
                    
                    <div className="user-info">
                      <h3 onClick={() => navigate(`/profile/${user.id}`)}>
                        {user.name}
                      </h3>
                      
                      {user.profile?.location && (
                        <p className="user-location">
                          📍 {user.profile.location}
                        </p>
                      )}
                      
                      {user.profile?.experienceYears > 0 && (
                        <p className="user-experience">
                          🐝 {user.profile.experienceYears} rokov skúseností
                        </p>
                      )}

                      {user.profile?.bio && (
                        <p className="user-bio">{user.profile.bio}</p>
                      )}

                      <div className="user-stats">
                        <span className="stat">
                          <strong>{user.stats?.totalHives || 0}</strong> úľov
                        </span>
                        <span className="stat">
                          <strong>{user.stats?.friendsCount || 0}</strong> priateľov
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/profile/${user.id}`)}
                      className="btn-view-profile"
                    >
                      Zobraziť profil
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
