import React, { useState } from 'react';
import { FaTaxi, FaGoogle } from 'react-icons/fa';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import './Login.css';

const Login = () => {
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      console.log("Iniciando sesión con Google...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Usuario logueado con éxito:", result.user);
    } catch (error) {
      console.error("Error completo de Firebase:", error);
      
      if (error.code === 'auth/operation-not-allowed') {
        setError("El inicio de sesión con Google no está habilitado en Firebase Console.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("El navegador bloqueó la ventana emergente. Por favor, permítela.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setError("Se canceló el inicio de sesión.");
      } else {
        setError("Error al iniciar sesión: " + error.message);
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="icon-container">
          <FaTaxi className="taxi-icon" />
        </div>
        <h1 className="title">Bienvenido a tucutaxi</h1>
        
        {error && <div className="error-message" style={{ color: 'red', marginBottom: '10px', fontSize: '0.9rem' }}>{error}</div>}
        
        <button className="google-button" onClick={handleGoogleLogin}>
          <FaGoogle className="google-icon" />
          <span>Iniciar sesión con Google</span>
        </button>
      </div>
    </div>
  );
};

export default Login;
