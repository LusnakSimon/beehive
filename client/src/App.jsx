import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HiveProvider } from './context/HiveContext'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Inspection from './pages/Inspection'
import Navigation from './components/Navigation'
import './App.css'

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <HiveProvider>
      <div className="app">
        {!isOnline && (
          <div className="offline-banner">
            ⚠️ Offline režim - niektoré funkcie sú obmedzené
          </div>
        )}
        
        <Navigation />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/inspection" element={<Inspection />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </HiveProvider>
  )
}

export default App
