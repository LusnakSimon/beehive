import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import './Admin.css';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newHiveId, setNewHiveId] = useState('');
  const toast = useToast();
  
  // Simulator state
  const [simulatorRunning, setSimulatorRunning] = useState(false);
  const [simulatorHive, setSimulatorHive] = useState('HIVE-001');
  const [simulatorInterval, setSimulatorInterval] = useState(null);
  const [lastReading, setLastReading] = useState(null);

  const [availableHives, setAvailableHives] = useState([]);

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
        // Compute available hive IDs from all users
        const allHives = data.flatMap(u => u.ownedHives || []);
        const hiveIds = Array.from(new Set(allHives.map(h => (typeof h === 'string' ? h : h?.id)).filter(Boolean)));
        if (hiveIds.length === 0) {
          setAvailableHives(['HIVE-001', 'HIVE-002', 'HIVE-003']);
        } else {
          hiveIds.sort((a, b) => {
            const na = parseInt(a.replace('HIVE-', '')) || 0;
            const nb = parseInt(b.replace('HIVE-', '')) || 0;
            return na - nb;
          });
          setAvailableHives(hiveIds);
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Nepodarilo sa načítať používateľov');
      }
    } catch (error) {
      toast.error('Chyba pri načítavaní používateľov');
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
        toast.success('Úľ bol pridelený');
      }
    } catch (error) {
      toast.error('Chyba pri prideľovaní úľa');
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
        toast.success('Úľ bol odobraný');
      }
    } catch (error) {
      toast.error('Chyba pri odoberaní úľa');
    }
  };
  
  const deleteUser = async (userId, userName) => {
    if (!confirm(`Naozaj chcete vymazať používateľa ${userName}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        await fetchUsers();
        toast.success('Používateľ bol úspešne vymazaný');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Nepodarilo sa vymazať používateľa');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Chyba pri mazaní používateľa');
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
        toast.success('Rola bola zmenená');
      }
    } catch (error) {
      toast.error('Chyba pri zmene roly');
    }
  };
  
  // LoRaWAN Simulator functions
  const generateReading = (hiveId) => {
    // Simulate realistic beehive readings
    const baseTemp = 35; // °C
    const baseHumidity = 60; // %
    const baseWeight = 45; // kg
    
    return {
      temperature: baseTemp + (Math.random() * 4 - 2), // 33-37°C
      humidity: baseHumidity + (Math.random() * 10 - 5), // 55-65%
      weight: baseWeight + (Math.random() * 2 - 1), // 44-46kg
      battery: 100 - Math.floor(Math.random() * 20), // 80-100%
      hiveId: hiveId,
      metadata: {
        source: 'LoRaWAN Simulator',
        rssi: -80 - Math.floor(Math.random() * 40), // Signal strength
        snr: 5 + Math.floor(Math.random() * 10) // Signal-to-noise ratio
      }
    };
  };
  
  const sendReading = async (hiveId) => {
    const reading = generateReading(hiveId);
    setLastReading(reading);
    
    try {
      const response = await fetch('/api/sensor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading)
      });
      
      if (!response.ok) {
        toast.error('Nepodarilo sa odoslať dáta');
      }
    } catch (error) {
      toast.error('Chyba pri odosílaní dát');
    }
  };
  
  const startSimulator = () => {
    if (simulatorRunning) return;
    
    setSimulatorRunning(true);
    localStorage.setItem('simulatorRunning', 'true');
    localStorage.setItem('simulatorHive', simulatorHive);
    
    sendReading(simulatorHive); // Send first reading immediately
    
    const interval = setInterval(() => {
      const currentHive = localStorage.getItem('simulatorHive') || 'HIVE-001';
      sendReading(currentHive);
    }, 10000); // Every 10 seconds
    
    setSimulatorInterval(interval);
  };
  
  const stopSimulator = () => {
    setSimulatorRunning(false);
    localStorage.removeItem('simulatorRunning');
    localStorage.removeItem('simulatorHive');
    
    if (simulatorInterval) {
      clearInterval(simulatorInterval);
      setSimulatorInterval(null);
    }
  };
  
  // Restore simulator state on mount
  useEffect(() => {
    const wasRunning = localStorage.getItem('simulatorRunning') === 'true';
    const savedHive = localStorage.getItem('simulatorHive');
    
    if (wasRunning && savedHive) {
      setSimulatorHive(savedHive);
      setSimulatorRunning(true);
      
      sendReading(savedHive); // Send immediately
      
      const interval = setInterval(() => {
        const currentHive = localStorage.getItem('simulatorHive') || savedHive;
        sendReading(currentHive);
      }, 10000);
      
      setSimulatorInterval(interval);
    }
    
    return () => {
      // Don't clear interval on unmount if simulator is running
      // It will be cleared when user explicitly stops it
    };
  }, []); // Empty dependency array - run only on mount

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
        {/* Statistics */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <p className="stat-label">Celkovo používateľov</p>
              <p className="stat-value">{users.length}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">👑</div>
            <div className="stat-info">
              <p className="stat-label">Administrátori</p>
              <p className="stat-value">{users.filter(u => u.role === 'admin').length}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏠</div>
            <div className="stat-info">
              <p className="stat-label">Pridelené úle</p>
              <p className="stat-value">
                {users.reduce((sum, u) => sum + (u.ownedHives?.length || 0), 0)}
              </p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <p className="stat-label">Dostupné úle</p>
              <p className="stat-value">{availableHives.length}</p>
            </div>
          </div>
        </div>
        
        {/* LoRaWAN Simulator */}
        <div className="simulator-panel">
          <h2>📡 LoRaWAN Simulátor</h2>
          <p>Simuluje IoT zariadenie odosielajúce senzorové dáta</p>
          
          <div className="simulator-controls">
            <div className="simulator-config">
              <label>
                Úľ:
                <select 
                  value={simulatorHive} 
                  onChange={(e) => setSimulatorHive(e.target.value)}
                  disabled={simulatorRunning}
                >
                    {availableHives.map(hive => (
                      <option key={hive} value={hive}>{hive}</option>
                    ))}
                </select>
              </label>
              
              <button 
                onClick={simulatorRunning ? stopSimulator : startSimulator}
                className={`simulator-btn ${simulatorRunning ? 'stop' : 'start'}`}
              >
                {simulatorRunning ? '⏸️ Zastaviť' : '▶️ Spustiť'}
              </button>
            </div>
            
            {simulatorRunning && (
              <div className="simulator-status">
                <span className="status-indicator">🟢 Aktívne (odosiela každých 10s)</span>
              </div>
            )}
            
            {lastReading && (
              <div className="last-reading">
                <h4>Posledné odoslané dáta:</h4>
                <div className="reading-data">
                  <span>🌡️ {lastReading.temperature.toFixed(1)}°C</span>
                  <span>💧 {lastReading.humidity.toFixed(1)}%</span>
                  <span>⚖️ {lastReading.weight.toFixed(1)}kg</span>
                  <span>🔋 {lastReading.battery}%</span>
                  <span>📶 RSSI: {lastReading.metadata.rssi}dBm</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
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
                    user.ownedHives.map(hive => {
                      // Handle both old format (string) and new format (object)
                      const hiveId = typeof hive === 'string' ? hive : hive.id;
                      const hiveName = typeof hive === 'string' ? hive : `${hive.name} (${hive.id})`;
                      return (
                        <div key={hiveId} className="hive-tag">
                          <span>🏠 {hiveName}</span>
                          <button
                            onClick={() => removeHive(user._id, hiveId)}
                            className="remove-btn"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
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
                      .filter(h => {
                        // Check if user already has this hive (handle both formats)
                        return !user.ownedHives?.some(owned => {
                          return typeof owned === 'string' ? owned === h : owned?.id === h;
                        });
                      })
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
                <button 
                  className="delete-user-btn"
                  onClick={() => deleteUser(user._id, user.name)}
                  title="Vymazať používateľa"
                >
                  🗑️ Vymazať
                </button>
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
