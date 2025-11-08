import { useState, useEffect } from 'react';
import './Admin.css';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newHiveId, setNewHiveId] = useState('');
  
  // Simulator state
  const [simulatorRunning, setSimulatorRunning] = useState(false);
  const [simulatorHive, setSimulatorHive] = useState('HIVE-001');
  const [simulatorInterval, setSimulatorInterval] = useState(null);
  const [lastReading, setLastReading] = useState(null);

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
  
  // LoRaWAN Simulator functions
  const generateReading = () => {
    // Simulate realistic beehive readings
    const baseTemp = 35; // °C
    const baseHumidity = 60; // %
    const baseWeight = 45; // kg
    
    return {
      temperature: baseTemp + (Math.random() * 4 - 2), // 33-37°C
      humidity: baseHumidity + (Math.random() * 10 - 5), // 55-65%
      weight: baseWeight + (Math.random() * 2 - 1), // 44-46kg
      battery: 100 - Math.floor(Math.random() * 20), // 80-100%
      hiveId: simulatorHive,
      metadata: {
        source: 'LoRaWAN Simulator',
        rssi: -80 - Math.floor(Math.random() * 40), // Signal strength
        snr: 5 + Math.floor(Math.random() * 10) // Signal-to-noise ratio
      }
    };
  };
  
  const sendReading = async () => {
    const reading = generateReading();
    setLastReading(reading);
    
    try {
      const response = await fetch('/api/sensor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading)
      });
      
      if (!response.ok) {
        console.error('Failed to send reading');
      }
    } catch (error) {
      console.error('Error sending reading:', error);
    }
  };
  
  const startSimulator = () => {
    if (simulatorRunning) return;
    
    setSimulatorRunning(true);
    sendReading(); // Send first reading immediately
    
    const interval = setInterval(() => {
      sendReading();
    }, 10000); // Every 10 seconds
    
    setSimulatorInterval(interval);
  };
  
  const stopSimulator = () => {
    setSimulatorRunning(false);
    if (simulatorInterval) {
      clearInterval(simulatorInterval);
      setSimulatorInterval(null);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulatorInterval) {
        clearInterval(simulatorInterval);
      }
    };
  }, [simulatorInterval]);

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
