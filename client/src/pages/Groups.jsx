import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './Groups.css';

const Groups = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'my-groups'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [error, setError] = useState('');

  const categories = [
    { value: '', label: 'Všetky kategórie' },
    { value: 'beekeeping', label: 'Včelárstvo' },
    { value: 'honey-production', label: 'Produkcia medu' },
    { value: 'bee-health', label: 'Zdravie včiel' },
    { value: 'equipment', label: 'Vybavenie' },
    { value: 'education', label: 'Vzdelávanie' },
    { value: 'local-community', label: 'Miestna komunita' },
    { value: 'commercial', label: 'Komerčné' },
    { value: 'hobby', label: 'Hobby' },
    { value: 'research', label: 'Výskum' },
    { value: 'other', label: 'Ostatné' }
  ];

  const fetchGroups = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filter === 'my-groups') {
        params.set('privacy', 'my-groups');
      } else {
        params.set('privacy', 'public');
      }
      if (searchTerm) params.set('search', searchTerm);
      if (selectedCategory) params.set('category', selectedCategory);

      const response = await fetch(`/api/groups?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();
      setGroups(data.groups);
      setError('');
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Nepodarilo sa načítať skupiny');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user, filter, selectedCategory]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchGroups();
  };

  const handleJoinGroup = async (groupId) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join group');
      }

      const data = await response.json();
      
      // Refresh groups list
      fetchGroups();
      
      // Show success message
      toast.success(data.message);
    } catch (err) {
      console.error('Error joining group:', err);
      toast.error(err.message || 'Nepodarilo sa pripojiť k skupine');
    }
  };

  if (!user) {
    return <div className="loading">Načítavam...</div>;
  }

  return (
    <div className="groups-page">
      <div className="groups-container">
        {/* Header */}
        <div className="groups-header">
          <div className="groups-header-content">
            <h1>Skupiny a komunity</h1>
            <p>Pripojte sa k včelárskym komunitám alebo vytvorte vlastnú skupinu</p>
          </div>
          <button 
            className="btn-create-group"
            onClick={() => navigate('/groups/create')}
          >
            + Vytvoriť skupinu
          </button>
        </div>

        {/* Filters */}
        <div className="groups-filters">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Všetky skupiny
            </button>
            <button
              className={`filter-tab ${filter === 'my-groups' ? 'active' : ''}`}
              onClick={() => setFilter('my-groups')}
            >
              Moje skupiny
            </button>
          </div>

          <form className="search-filter-row" onSubmit={handleSearch}>
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Hľadať skupiny..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button">
                🔍
              </button>
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="groups-error">
            ⚠️ {error}
          </div>
        )}

        {/* Groups Grid */}
        {loading ? (
          <div className="loading">Načítavam skupiny...</div>
        ) : groups.length === 0 ? (
          <div className="no-groups">
            <span className="no-groups-icon">👥</span>
            <h3>Žiadne skupiny</h3>
            <p>
              {filter === 'my-groups' 
                ? 'Zatiaľ nie ste členom žiadnej skupiny. Preskúmajte verejné skupiny!'
                : 'Nenašli sa žiadne skupiny. Skúste iné filtre alebo vytvorte vlastnú skupinu.'}
            </p>
            {filter === 'my-groups' && (
              <button 
                className="btn-primary"
                onClick={() => setFilter('all')}
              >
                Preskúmať skupiny
              </button>
            )}
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map(group => (
              <div key={group.id} className="group-card">
                {/* Cover Image */}
                <div 
                  className="group-cover"
                  style={{
                    backgroundImage: group.coverImage 
                      ? `url(${group.coverImage})` 
                      : 'var(--btn-primary-gradient)'
                  }}
                >
                  {group.privacy === 'private' && (
                    <span className="privacy-badge">🔒 Súkromná</span>
                  )}
                </div>

                {/* Content */}
                <div className="group-content">
                  <div className="group-icon-row">
                    {group.icon ? (
                      <img src={group.icon} alt={group.name} className="group-icon" />
                    ) : (
                      <div className="group-icon-placeholder">
                        {group.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h3 className="group-name">{group.name}</h3>
                  
                  <p className="group-description">
                    {group.description || 'Žiadny popis'}
                  </p>

                  <div className="group-meta">
                    <span className="group-meta-item">
                      👥 {group.memberCount} členov
                    </span>
                    {group.location && (
                      <span className="group-meta-item">
                        📍 {group.location}
                      </span>
                    )}
                  </div>

                  <div className="group-actions">
                    <button
                      className="btn-view-group"
                      onClick={() => navigate(`/groups/${group.id}`)}
                    >
                      Zobraziť skupinu
                    </button>
                    
                    {!group.isMember && (
                      <button
                        className="btn-join-group"
                        onClick={() => handleJoinGroup(group.id)}
                      >
                        {group.privacy === 'private' ? 'Požiadať o vstup' : 'Pripojiť sa'}
                      </button>
                    )}
                    
                    {group.isMember && (
                      <span className="member-badge">✓ Člen</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
