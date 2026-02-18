import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { 
  FaUsers, FaCar, FaRoute, FaChartLine, FaCog, FaClipboardList, 
  FaBars, FaTimes, FaSignOutAlt, FaTaxi 
} from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const handleLogout = () => {
    signOut(auth);
  };

  const menuItems = [
    { path: '/admin/dashboard', name: 'Dashboard', icon: <FaChartLine /> },
    { path: '/admin/users', name: 'Usuarios', icon: <FaUsers /> },
    { path: '/admin/vehicles', name: 'Vehículos', icon: <FaCar /> },
    { path: '/admin/trips', name: 'Viajes', icon: <FaRoute /> },
    /* { path: '/admin/earnings', name: 'Ganancias', icon: <FaChartLine /> }, */
    { path: '/admin/requests', name: 'Solicitudes', icon: <FaClipboardList /> },
    { path: '/admin/settings', name: 'Configuración', icon: <FaCog /> },
  ];

  return (
    <div className="d-flex min-vh-100 bg-light">
      {/* Sidebar */}
      <div 
        className={`bg-dark text-white p-3 d-flex flex-column transition-all ${sidebarOpen ? 'w-250px' : 'w-80px'}`}
        style={{ 
          minWidth: sidebarOpen ? '250px' : '80px', 
          maxWidth: sidebarOpen ? '250px' : '80px',
          transition: 'all 0.3s ease'
        }}
      >
        <div className="d-flex align-items-center justify-content-between mb-4 px-2">
          {sidebarOpen && <h4 className="m-0 fw-bold text-warning"><FaTaxi className="me-2"/>Admin</h4>}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn btn-sm btn-outline-light border-0"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <nav className="flex-grow-1">
          <ul className="nav flex-column gap-2">
            {menuItems.map((item) => (
              <li key={item.path} className="nav-item">
                <Link 
                  to={item.path}
                  className={`nav-link d-flex align-items-center px-3 py-3 rounded-3 transition-all ${
                    location.pathname === item.path 
                      ? 'bg-warning text-dark fw-bold shadow-sm' 
                      : 'text-white-50 hover-bg-dark-light'
                  }`}
                  title={!sidebarOpen ? item.name : ''}
                >
                  <span className="fs-5">{item.icon}</span>
                  {sidebarOpen && <span className="ms-3">{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto border-top border-secondary pt-3">
          <button 
            onClick={handleLogout}
            className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2"
          >
            <FaSignOutAlt />
            {sidebarOpen && "Cerrar Sesión"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        <header className="bg-white shadow-sm p-3 d-flex justify-content-between align-items-center">
          <h5 className="m-0 fw-bold text-secondary">
            {menuItems.find(item => item.path === location.pathname)?.name || 'Panel Administrativo'}
          </h5>
          <div className="d-flex align-items-center gap-3">
            <div className="bg-light rounded-circle p-2 border">
              <FaUserCircle className="text-secondary fs-4" />
            </div>
          </div>
        </header>

        <main className="flex-grow-1 p-4 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Simple icon placeholder if not imported
import { FaUserCircle } from 'react-icons/fa';

export default AdminLayout;
