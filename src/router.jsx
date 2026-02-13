import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Drivers from './pages/Drivers'
import TripDetails from './pages/TripDetails'
import Profile from './pages/Profile'

const ProtectedRoute = ({ children, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

const Router = ({ user }) => {
  return (
    <Routes>
      <Route path="/" element={<Home user={user} />} />
      <Route path="/login" element={!user ? <Login user={user} /> : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute user={user}>
          <Dashboard user={user} />
        </ProtectedRoute>
      } />
      <Route path="/drivers" element={
        <ProtectedRoute user={user}>
          <Drivers user={user} />
        </ProtectedRoute>
      } />
      <Route path="/trip/:id" element={
        <ProtectedRoute user={user}>
          <TripDetails user={user} />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute user={user}>
          <Profile user={user} />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default Router;
