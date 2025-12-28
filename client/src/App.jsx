import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HiveProvider } from './context/HiveContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import { DashboardSkeleton, ListSkeleton } from './components/Skeleton'

// Core pages - loaded eagerly for fast initial load
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Navigation from './components/Navigation'
import ProtectedRoute from './components/ProtectedRoute'
import VarroaReminder from './components/VarroaReminder'

// Lazy loaded pages - loaded on demand to reduce initial bundle
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const Inspection = lazy(() => import('./pages/Inspection'))
const Profile = lazy(() => import('./pages/Profile'))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'))
const FriendRequests = lazy(() => import('./pages/FriendRequests'))
const Friends = lazy(() => import('./pages/Friends'))
const UserSearch = lazy(() => import('./pages/UserSearch'))
const Messages = lazy(() => import('./pages/Messages'))
const Chat = lazy(() => import('./pages/Chat'))
const Groups = lazy(() => import('./pages/Groups'))
const CreateGroup = lazy(() => import('./pages/CreateGroup'))
const GroupDetail = lazy(() => import('./pages/GroupDetail'))
const GroupChat = lazy(() => import('./pages/GroupChat'))
const Notifications = lazy(() => import('./pages/Notifications'))
const HiveMap = lazy(() => import('./pages/HiveMap'))

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
              <Route path="/map" element={<ProtectedRoute><HiveMap /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><UserSearch /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
              <Route path="/friends/requests" element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/messages/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
              <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
              <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
              <Route path="/groups/:groupId/chat" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </main>

          <VarroaReminder />
        </div>
      </HiveProvider>
      </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
