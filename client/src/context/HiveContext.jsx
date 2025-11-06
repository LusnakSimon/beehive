import { createContext, useContext, useState, useEffect } from 'react'

const HiveContext = createContext()

export function useHive() {
  const context = useContext(HiveContext)
  if (!context) {
    throw new Error('useHive must be used within HiveProvider')
  }
  return context
}

export function HiveProvider({ children }) {
  const [selectedHive, setSelectedHive] = useState(() => {
    return localStorage.getItem('selectedHive') || 'HIVE-001'
  })
  
  const [hives, setHives] = useState([
    { id: 'HIVE-001', name: 'Úľ 1', location: 'Záhrada A', color: '#fbbf24' },
    { id: 'HIVE-002', name: 'Úľ 2', location: 'Záhrada B', color: '#3b82f6' },
    { id: 'HIVE-003', name: 'Úľ 3', location: 'Záhrada C', color: '#10b981' }
  ])

  useEffect(() => {
    localStorage.setItem('selectedHive', selectedHive)
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
