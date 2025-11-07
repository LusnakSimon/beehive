import { useState, useEffect } from 'react';
import './Admin.css';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newHiveId, setNewHiveId] = useState('');

  const availableHives = ['HIVE-001', 'HIVE-002', 'HIVE-003', 'HIVE-004'];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignHive = async (userId, hiveId) => {
    try {
      const response = await fetch(`/api/users/${userId}/hives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hiveId })
      });

      if (response.ok) {
        await fetchUsers();
        setNewHiveId('');
      }
    } catch (error) {
      console.error('Error assigning hive:', error);
    }
  };

  const removeHive = async (userId, hiveId) => {
    try {
      const response = await fetch(`/api/users/${userId}/hives/${hiveId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error removing hive:', error);
    }
  };

  const toggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  if (loading) {
    return (
      <div className="admin-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p>Správa používateľov a úľov</p>
      </div>

      <div className="admin-content">
        <div className="users-grid">
          {users.map(user => (
            <div key={user._id} className="user-card">
              <div className="user-header">
                {user.image && (
                  <img src={user.image} alt={user.name} className="user-avatar" />
                )}
                <div className="user-info">
                  <h3>{user.name}</h3>
                  <p className="user-email">{user.email}</p>
                </div>
                <button
                  onClick={() => toggleRole(user._id, user.role)}
                  className={`role-badge ${user.role}`}
                >
                  {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                </button>
              </div>

              <div className="user-hives">
                <h4>Pridelené úle ({user.ownedHives?.length || 0})</h4>
                <div className="hives-list">
                  {user.ownedHives && user.ownedHives.length > 0 ? (
                    user.ownedHives.map(hiveId => (
                      <div key={hiveId} className="hive-tag">
                        <span>🏠 {hiveId}</span>
                        <button
                          onClick={() => removeHive(user._id, hiveId)}
                          className="remove-btn"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="no-hives">Žiadne pridelené úle</p>
                  )}
                </div>

                <div className="assign-hive">
                  <select
                    value={newHiveId}
                    onChange={(e) => setNewHiveId(e.target.value)}
                    className="hive-select"
                  >
                    <option value="">Vyber úľ...</option>
                    {availableHives
                      .filter(h => !user.ownedHives?.includes(h))
                      .map(hiveId => (
                        <option key={hiveId} value={hiveId}>
                          {hiveId}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      if (newHiveId) {
                        assignHive(user._id, newHiveId);
                      }
                    }}
                    disabled={!newHiveId}
                    className="assign-btn"
                  >
                    + Prideliť
                  </button>
                </div>
              </div>

              <div className="user-meta">
                <span>Vytvorený: {new Date(user.createdAt).toLocaleDateString('sk')}</span>
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="no-users">
            <p>Zatiaľ žiadni používatelia</p>
          </div>
        )}
      </div>
    </div>
  );
}
