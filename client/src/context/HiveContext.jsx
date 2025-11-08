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
      const userHives = user.ownedHives.map((hiveId, index) => {
        const colors = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']
        const number = hiveId.replace('HIVE-', '')
        return {
          id: hiveId,
          name: `Úľ ${number}`,
          location: `Záhrada ${String.fromCharCode(65 + index)}`, // A, B, C...
          color: colors[index % colors.length]
        }
      })
      setHives(userHives)
      
      // Set first hive as selected if none selected or selected hive not in user's hives
      if (!selectedHive || !user.ownedHives.includes(selectedHive)) {
        setSelectedHive(userHives[0].id)
      }
    } else {
      // User has no hives - set empty state
      setHives([])
      setSelectedHive(null)
    }
  }, [user])

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
      setSelectedHive(hives[0]?.id || 'HIVE-001')
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
