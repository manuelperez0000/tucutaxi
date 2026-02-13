import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTaxi } from 'react-icons/fa';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-icon-container">
          <FaTaxi className="home-taxi-icon" />
        </div>
        <h1 className="home-title">tucutaxi</h1>
        <p className="home-subtitle">Tu viaje seguro y rápido</p>
        <button 
          className="login-redirect-button" 
          onClick={() => navigate('/login')}
        >
          Iniciar Sesión
        </button>
      </div>
    </div>
  );
};

export default Home;
