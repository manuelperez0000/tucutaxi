import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Drivers from './pages/Drivers'
import TripDetails from './pages/TripDetails'
import Profile from './pages/Profile'
import Drive from './pages/Drive'
import RegisterVehicle from './pages/RegisterVehicle'
import MyVehicle from './pages/MyVehicle'
import MyTrips from './pages/mytrips'
import Billing from './pages/Billing'

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetails from './pages/admin/AdminUserDetails';
import AdminVehicles from './pages/admin/AdminVehicles';
import AdminTrips from './pages/admin/AdminTrips';
import AdminEarnings from './pages/admin/AdminEarnings';
import AdminRequests from './pages/admin/AdminRequests';
import AdminSettings from './pages/admin/AdminSettings';
import AdminPayments from './pages/admin/AdminPayments';

const ProtectedRoute = ({ children, user }) => {
  if (!user) {
    return <Navigate to="/" replace />
  }
  return children
}

const AdminRoute = ({ children, user }) => {
  const adminId = import.meta.env.VITE_ADMIN_ID;
  
  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.uid !== adminId) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

const Router = ({ user }) => {
  return (
    <Routes>
      <Route path="/" element={<Home user={user} />} />
      
      <Route path="/drive/:id" element={
        <ProtectedRoute user={user}>
          <Drive user={user} />
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute user={user}>
          <Dashboard user={user} />
        </ProtectedRoute>
      } />

      <Route path="/my-trips" element={
        <ProtectedRoute user={user}>
          <MyTrips user={user} />
        </ProtectedRoute>
      } />

      <Route path="/billing" element={
        <ProtectedRoute user={user}>
          <Billing user={user} />
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
      <Route path="/register-vehicle" element={
        <ProtectedRoute user={user}>
          <RegisterVehicle user={user} />
        </ProtectedRoute>
      } />
      <Route path="/my-vehicle" element={
        <ProtectedRoute user={user}>
          <MyVehicle user={user} />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <AdminRoute user={user}>
          <AdminLayout />
        </AdminRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:userId" element={<AdminUserDetails />} />
        <Route path="vehicles" element={<AdminVehicles />} />
        <Route path="trips" element={<AdminTrips />} />
        <Route path="earnings" element={<AdminEarnings />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default Router;
