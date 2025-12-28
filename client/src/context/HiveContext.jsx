import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const HiveContext = createContext()

export function useHive() {
  const context = useContext(HiveContext)
  if (!context) {
    throw new Error('useHive must be used within HiveProvider')
  }
  return context
}

export function HiveProvider({ children }) {
  const { user } = useAuth()
  
  const [selectedHive, setSelectedHive] = useState(() => {
    return localStorage.getItem('selectedHive') || null
  })
  
  // Generate hives from user's ownedHives
  const [hives, setHives] = useState([])
  
  useEffect(() => {
    if (user && user.ownedHives && user.ownedHives.length > 0) {
      // Map user's hives - they come as objects from DB now
      const userHives = user.ownedHives.map(hive => {
        // Handle both old format (string) and new format (object)
        if (typeof hive === 'string') {
          // Old format - generate default metadata
          const colors = ['var(--warning)', 'var(--primary)', 'var(--success)', 'var(--danger)', 'var(--secondary)'];
          const number = hive.replace('HIVE-', '');
          const index = user.ownedHives.indexOf(hive);
          return {
            id: hive,
            name: `Úľ ${number}`,
            location: `Záhrada ${String.fromCharCode(65 + index)}`,
            color: colors[index % colors.length]
          };
        } else {
          // New format - use metadata from DB
          return {
            id: hive.id,
            name: hive.name,
            location: hive.location || '',
            color: hive.color || 'var(--warning)'
          };
        }
      });
      setHives(userHives);
      
      // Set first hive as selected if none selected or selected hive not in user's hives
      const hiveIds = userHives.map(h => h.id);
      if (!selectedHive || !hiveIds.includes(selectedHive)) {
        setSelectedHive(userHives[0].id);
      }
    } else {
      // User has no hives - set empty state
      setHives([]);
      setSelectedHive(null);
    }
  }, [user]);

  useEffect(() => {
    if (selectedHive) {
      localStorage.setItem('selectedHive', selectedHive)
    }
  }, [selectedHive])

  const getCurrentHive = () => {
    return hives.find(h => h.id === selectedHive) || hives[0]
  }

  const addHive = (hive) => {
    setHives(prev => [...prev, hive])
  }

  const updateHive = (id, updates) => {
    setHives(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h))
  }

  const deleteHive = (id) => {
    setHives(prev => prev.filter(h => h.id !== id))
    if (selectedHive === id) {
      setSelectedHive(hives[0]?.id || null)
    }
  }

  return (
    <HiveContext.Provider value={{
      selectedHive,
      setSelectedHive,
      hives,
      setHives,
      getCurrentHive,
      addHive,
      updateHive,
      deleteHive
    }}>
      {children}
    </HiveContext.Provider>
  )
}
