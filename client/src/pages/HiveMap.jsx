import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { useAuth } from '../contexts/AuthContext'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './HiveMap.css'

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

export default function HiveMap() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hives, setHives] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHive, setSelectedHive] = useState(null)
  const [showDistances, setShowDistances] = useState(false)
  const [mapCenter, setMapCenter] = useState([48.7164, 21.2611]) // Default: Košice
  const [mapZoom, setMapZoom] = useState(13)
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const [error, setError] = useState(null)

  // Fetch hives on mount and when user's hives change
  useEffect(() => {
    if (user) {
      fetchHives()
    }
  }, [user, lastUpdate]) // Re-fetch when lastUpdate changes

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && !document.hidden) {
        setLastUpdate(Date.now())
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [user])

  // Also refresh when page becomes visible (user returns from Settings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        setLastUpdate(Date.now()) // Trigger refresh
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refresh when window gains focus
    const handleFocus = () => {
      if (user) {
        setLastUpdate(Date.now()) // Trigger refresh
      }
    }
    
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])

  const fetchHives = async () => {
    try {
      setError(null) // Clear previous errors
      const response = await fetch('/api/users/hives/map', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        console.log('📍 Map API response:', data)
        console.log('📍 Hives received:', data.hives?.length || 0)
        
        if (data.hives) {
          setHives(data.hives)
          
          // Center map on user's first hive if available
          const myHive = data.hives.find(h => h.isOwner)
          if (myHive) {
            setMapCenter([myHive.coordinates.lat, myHive.coordinates.lng])
          }
        } else {
          console.error('❌ No hives array in response:', data)
          setHives([])
        }
      } else if (response.status === 401) {
        setError('Nie si prihlásený. Prosím prihlás sa.')
        console.error('❌ Map API error: 401 Unauthorized')
        setHives([])
      } else {
        const errorText = await response.text()
        setError(`API chyba: ${response.status}. ${errorText}`)
        console.error('❌ Map API error:', response.status, errorText)
        setHives([])
      }
    } catch (error) {
      console.error('❌ Error fetching hives:', error)
      setError(`Chyba pripojenia: ${error.message}. Skontroluj či backend beží.`)
      setHives([])
    } finally {
      setLoading(false)
    }
  }

  const createCustomIcon = (color, isOwner) => {
    const iconHtml = `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid ${isOwner ? '#fff' : '#666'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      ">
        🐝
      </div>
    `
    
    return L.divIcon({
      html: iconHtml,
      className: 'custom-hive-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    })
  }

  const getDistances = (hive) => {
    if (!hive.coordinates) return []
    
    return hives
      .filter(h => h.id !== hive.id && h.coordinates)
      .map(otherHive => ({
        hive: otherHive,
        distance: calculateDistance(
          hive.coordinates.lat,
          hive.coordinates.lng,
          otherHive.coordinates.lat,
          otherHive.coordinates.lng
        )
      }))
      .sort((a, b) => a.distance - b.distance)
  }

  const myHives = hives.filter(h => h.isOwner)
  const publicHives = hives.filter(h => !h.isOwner)

  if (loading) {
    return (
      <div className="hive-map-page">
        <div className="loading">Načítavam mapu...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hive-map-page">
        <div className="map-error">
          <h2>⚠️ Chyba pri načítavaní mapy</h2>
          <p>{error}</p>
          <button 
            className="btn-refresh-map" 
            onClick={() => {
              setLoading(true)
              setLastUpdate(Date.now())
            }}
          >
            🔄 Skúsiť znova
          </button>
          <div className="error-hint">
            <p><strong>Tipy na riešenie:</strong></p>
            <ul>
              <li>Skontroluj či si prihlásený</li>
              <li>Skontroluj browser console (F12) pre viac detailov</li>
              <li>Pre lokálny development pozri <code>LOCAL_DEVELOPMENT.md</code></li>
              <li>Alebo testuj na production: <a href="https://sbeehive.vercel.app" target="_blank">sbeehive.vercel.app</a></li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hive-map-page">
      <div className="map-header">
        <h1>🗺️ Mapa úľov</h1>
        <div className="map-stats">
          <span className="stat">
            <strong>{myHives.length}</strong> mojich úľov
          </span>
          <span className="stat">
            <strong>{publicHives.length}</strong> verejných úľov
          </span>
          <button 
            className="btn-refresh-map"
            onClick={() => {
              setLoading(true)
              setLastUpdate(Date.now()) // Trigger refresh
            }}
            title="Obnoviť mapu"
          >
            🔄 Obnoviť
          </button>
        </div>
      </div>

      <div className="map-controls">
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={showDistances}
            onChange={(e) => setShowDistances(e.target.checked)}
          />
          <span>Zobraziť vzdialenosti</span>
        </label>
      </div>

      <div className="map-container-wrapper">
        {hives.length === 0 ? (
          <div className="no-hives-map">
            <p>📍 Žiadne úle s GPS súradnicami</p>
            <p>Pridaj súradnice k svojim úľom v nastaveniach</p>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '600px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {hives.map(hive => (
              <Marker
                key={hive.id}
                position={[hive.coordinates.lat, hive.coordinates.lng]}
                icon={createCustomIcon(hive.color, hive.isOwner)}
                eventHandlers={{
                  click: () => setSelectedHive(hive)
                }}
              >
                <Popup>
                  <div className="hive-popup">
                    <h3>{hive.name}</h3>
                    <p className="hive-id">{hive.id}</p>
                    {hive.location && <p>📍 {hive.location}</p>}
                    <p className="hive-owner">
                      {hive.isOwner ? '✅ Tvoj úľ' : `👤 ${hive.owner.name}`}
                    </p>
                    <p className="hive-visibility">
                      {hive.visibility === 'public' ? '🌍 Verejný' : '🔒 Súkromný'}
                    {!hive.isOwner && (
                      <button
                        className="btn-view-profile"
                        onClick={() => navigate(`/profile/${hive.owner.id}`)}
                      >
                        👤 View Profile
                      </button>
                    )}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Show distance lines if enabled and a hive is selected */}
            {showDistances && selectedHive && selectedHive.coordinates && (
              <>
                {hives
                  .filter(h => h.id !== selectedHive.id && h.coordinates)
                  .map(otherHive => (
                    <Polyline
                      key={`${selectedHive.id}-${otherHive.id}`}
                      positions={[
                        [selectedHive.coordinates.lat, selectedHive.coordinates.lng],
                        [otherHive.coordinates.lat, otherHive.coordinates.lng]
                      ]}
                      color={selectedHive.color}
                      weight={2}
                      opacity={0.5}
                      dashArray="5, 10"
                    />
                  ))
                }
              </>
            )}
          </MapContainer>
        )}
      </div>

      {selectedHive && (
        <div className="distance-panel">
          <h3>Vzdialenosti od: {selectedHive.name}</h3>
          <div className="distances-list">
            {getDistances(selectedHive).map(({ hive, distance }) => (
              <div key={hive.id} className="distance-item">
                <div className="distance-hive">
                  <span style={{ color: hive.color }}>●</span>
                  <span>{hive.name}</span>
                  {hive.isOwner && <span className="owner-badge">Tvoj</span>}
                </div>
                <div className="distance-value">
                  {distance < 1 
                    ? `${Math.round(distance * 1000)} m`
                    : `${distance.toFixed(2)} km`
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="map-legend">
        <h4>Legenda</h4>
        <div className="legend-item">
          <div className="legend-marker" style={{ border: '3px solid #fff' }}>🐝</div>
          <span>Tvoje úle</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker" style={{ border: '3px solid #666' }}>🐝</div>
          <span>Verejné úle iných používateľov</span>
        </div>
      </div>
    </div>
  )
}
