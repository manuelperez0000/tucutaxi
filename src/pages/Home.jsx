import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaTaxi, FaGoogle, FaEnvelope, FaLock, 
  FaPhone, FaUser, FaArrowLeft, FaChevronRight 
} from 'react-icons/fa';
import { 
  signInWithRedirect, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import './Home.css';

const Home = ({ user }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('selection'); // 'selection', 'register-email', 'login-email'
  
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    phone: ''
  });

  const handleViewChange = (newView) => {
    setError(null);
    setView(newView);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      setError("Error al conectar con Google.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (view === 'register-email') {
        // Registro manual
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: formData.displayName });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName: formData.displayName,
          email: formData.email,
          phone: formData.phone,
          photoURL: null,
          createdAt: serverTimestamp()
        });
      } else if (view === 'login-email') {
        // Login tradicional
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      }
    } catch (error) {
      console.error("Error en autenticación:", error);
      if (error.code === 'auth/email-already-in-use') setError("El correo ya está registrado.");
      else if (error.code === 'auth/weak-password') setError("La contraseña es muy débil.");
      else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') setError("Credenciales incorrectas.");
      else setError("Ocurrió un error. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-hero">
      <div className="home-content-wrapper">
        <header className="home-brand">
          <div className="brand-icon-box">
            <FaTaxi className="brand-icon" />
          </div>
          <h1 className="brand-name">TUCUTAXI</h1>
        </header>

        <div className="home-actions">
          <div className="auth-card">
            
            {/* VISTA DE SELECCIÓN INICIAL */}
            {view === 'selection' && (
              <div className="auth-view-content">
                <div className="auth-header">
                  <h2>Empieza ahora</h2>
                  <p>Elige cómo quieres unirte a tucutaxi</p>
                </div>
                <div className="auth-selection">
                  <button className="btn-selection primary" onClick={() => handleViewChange('register-email')}>
                    <FaEnvelope /> Registrarse con Correo
                  </button>
                  <button className="btn-selection" onClick={handleGoogleLogin} disabled={loading}>
                    <FaGoogle className="google-icon-svg" /> Registrarse con Google
                  </button>
                  
                  <div className="auth-divider">¿Ya tienes cuenta?</div>
                  
                  <button className="btn-selection" onClick={() => handleViewChange('login-email')}>
                    <FaLock /> Iniciar Sesión con Correo
                  </button>
                </div>
              </div>
            )}

            {/* VISTA DE REGISTRO CON EMAIL */}
            {view === 'register-email' && (
              <div className="auth-view-content">
                <button className="btn-back" onClick={() => handleViewChange('selection')}>
                  <FaArrowLeft /> Volver
                </button>
                <div className="auth-header">
                  <h2>Crear cuenta</h2>
                  <p>Completa tus datos para empezar</p>
                </div>
                
                {error && <div className="home-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                  <div className="input-group-auth">
                    <label>Nombre completo</label>
                    <div className="input-wrapper">
                      <FaUser className="input-icon" />
                      <input type="text" name="displayName" placeholder="Tu nombre" onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label>Número de teléfono</label>
                    <div className="input-wrapper">
                      <FaPhone className="input-icon" />
                      <input type="tel" name="phone" placeholder="+54 9..." onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label>Correo electrónico</label>
                    <div className="input-wrapper">
                      <FaEnvelope className="input-icon" />
                      <input type="email" name="email" placeholder="ejemplo@correo.com" onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label>Contraseña</label>
                    <div className="input-wrapper">
                      <FaLock className="input-icon" />
                      <input type="password" name="password" placeholder="••••••••" onChange={handleChange} required />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary-auth" disabled={loading}>
                    {loading ? 'Procesando...' : (
                      <>
                        Finalizar Registro <FaChevronRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* VISTA DE LOGIN CON EMAIL */}
            {view === 'login-email' && (
              <div className="auth-view-content">
                <button className="btn-back" onClick={() => handleViewChange('selection')}>
                  <FaArrowLeft /> Volver
                </button>
                <div className="auth-header">
                  <h2>Bienvenido de nuevo</h2>
                  <p>Ingresa tus credenciales</p>
                </div>

                {error && <div className="home-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                  <div className="input-group-auth">
                    <label>Correo electrónico</label>
                    <div className="input-wrapper">
                      <FaEnvelope className="input-icon" />
                      <input type="email" name="email" placeholder="ejemplo@correo.com" onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label>Contraseña</label>
                    <div className="input-wrapper">
                      <FaLock className="input-icon" />
                      <input type="password" name="password" placeholder="••••••••" onChange={handleChange} required />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary-auth" disabled={loading}>
                    {loading ? 'Iniciando...' : (
                      <>
                        Entrar <FaChevronRight size={14} />
                      </>
                    )}
                  </button>
                </form>
                
                <div className="auth-switch text-center mt-4">
                  ¿No tienes cuenta? <span onClick={() => handleViewChange('register-email')}>Regístrate aquí</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
