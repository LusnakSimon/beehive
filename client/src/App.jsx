import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HiveProvider } from './context/HiveContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import { DashboardSkeleton } from './components/Skeleton'

// Core pages - loaded eagerly for fast initial load
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Navigation from './components/Navigation'
import ProtectedRoute from './components/ProtectedRoute'

// Lazy loaded pages - loaded on demand to reduce initial bundle
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))
const Inspection = lazy(() => import('./pages/Inspection'))
const MyHives = lazy(() => import('./pages/MyHives'))
const Harvests = lazy(() => import('./pages/Harvests'))

import './colors.css'
import './App.css'

// Loading fallback component
function PageLoader() {
  return (
    <div className="page-loader">
      <DashboardSkeleton />
    </div>
  )
}

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
    <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
      <NotificationProvider>
        <HiveProvider>
        <div className="app">
          {!isOnline && (
            <div className="offline-banner" role="alert">
              ⚠️ Offline režim - niektoré funkcie sú obmedzené
            </div>
          )}
          
          <Navigation />
          
          <main className="main-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/inspection" element={<ProtectedRoute><Inspection /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/my-hives" element={<ProtectedRoute><MyHives /></ProtectedRoute>} />
              <Route path="/harvests" element={<ProtectedRoute><Harvests /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </HiveProvider>
      </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
