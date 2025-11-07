import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HiveProvider } from './context/HiveContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Inspection from './pages/Inspection'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Navigation from './components/Navigation'
import ProtectedRoute from './components/ProtectedRoute'
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
    <AuthProvider>
      <NotificationProvider>
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
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/inspection" element={<ProtectedRoute><Inspection /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              </Routes>
          </main>
        </div>
      </HiveProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
