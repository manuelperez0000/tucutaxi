import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { FaUserCircle, FaTaxi, FaEnvelope, FaCar, FaChartLine, FaMap, FaHistory, FaIdCard } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Navbar = ({ user }) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3 shadow-sm">
      <div className="container-fluid">
        <Link className="navbar-brand d-flex align-items-center gap-2 text-white" to="/">
          <span className="fw-bold font-giro" style={{ fontSize: '1.5rem' }}>GIRO</span>
        </Link>

        <button
          className="navbar-toggler border-white"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-2 pt-3 pt-lg-0">
            <li className="nav-items">
              <Link className="nav-link btn btn-dark text-white border-0 text-start" to="/dashboard">
                <FaMap className="me-2" /> Inicio
              </Link>
            </li>

            <li className="nav-items">
              <Link className="nav-link btn btn-dark text-white border-0 text-start" to="/my-trips">
                <FaHistory className="me-2" /> Mis Viajes
              </Link>
            </li>

            <li className="nav-item">
              <Link className="nav-link btn btn-dark text-white border-0 text-start" to="/drivers">
                <FaIdCard className="me-2" /> Ser conductor
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link btn btn-dark text-white border-0 text-start" to="/my-vehicle">
                <FaCar className="me-2" /> Mi Vehículo
              </Link>
            </li>
            {/* <li className="nav-item">
              <a className="nav-link btn btn-dark text-white border-0 text-start" href="#">
                <FaEnvelope className="me-2" /> Contactar
              </a>
            </li> */}
            <li className="nav-items">
              <Link className="nav-link btn btn-dark text-white border-0" to="/profile">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Perfil"
                    className="rounded-circle mx-2"
                    style={{ width: '28px', height: '28px' }}
                  />
                ) : (
                  <FaUserCircle className="text-white fs-4" />
                )}
                Perfil
              </Link>
            </li>
            <li className="nav-item mt-2 mt-lg-0">
              <button
                onClick={handleLogout}
                className="btn btn-danger w-100 w-lg-auto"
              >
                Cerrar Sesión
              </button>
            </li>

          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
