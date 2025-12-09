import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HiveProvider } from './context/HiveContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Inspection from './pages/Inspection'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import FriendRequests from './pages/FriendRequests'
import Friends from './pages/Friends'
import UserSearch from './pages/UserSearch'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Groups from './pages/Groups'
import CreateGroup from './pages/CreateGroup'
import GroupDetail from './pages/GroupDetail'
import GroupChat from './pages/GroupChat'
import Notifications from './pages/Notifications'
import HiveMap from './pages/HiveMap'
import Navigation from './components/Navigation'
import ProtectedRoute from './components/ProtectedRoute'
import VarroaReminder from './components/VarroaReminder'
import './colors.css'
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
          </main>
          
          <VarroaReminder />
        </div>
      </HiveProvider>
      </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
