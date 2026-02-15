import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaTaxi, FaGoogle, FaEnvelope, FaLock, 
  FaPhone, FaUser, FaArrowLeft, FaChevronRight 
} from 'react-icons/fa';
import { 
  signInWithRedirect, 
  signInWithPopup,
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
      await signInWithPopup(auth, googleProvider);
      // La navegación a /dashboard ocurrirá automáticamente gracias al useEffect que escucha 'user'
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
    <div className="home-hero min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="home-content-wrapper w-100">
        <header className="home-brand d-flex align-items-center justify-content-center gap-3 mb-4">
          <div className="brand-icon-box bg-warning p-3 rounded-4 shadow">
            <FaTaxi className="brand-icon fs-1 text-dark" />
          </div>
          <h1 className="brand-name text-white fw-bold display-4 m-0">TUCUTAXI</h1>
        </header>

        <div className="home-actions d-flex flex-column align-items-center w-100">
          <div className="auth-card p-3 p-md-5 rounded-4 shadow-lg w-100" >
            
            {/* VISTA DE SELECCIÓN INICIAL */}
            {view === 'selection' && (
              <div className="auth-view-content animate__animated animate__fadeIn">
                <div className="auth-header text-center mb-4">
                  <h2 className="fw-bold mb-2">Empieza ahora</h2>
                  <p className="text-muted">Elige cómo quieres unirte a tucutaxi</p>
                </div>
                <div className="auth-selection d-grid gap-3">
                  <button className="btn btn-warning btn-lg fw-bold d-flex align-items-center justify-content-center gap-2 rounded-4 py-3" onClick={() => handleViewChange('register-email')}>
                    <FaEnvelope /> Registrarse con Correo
                  </button>
                  <button className="btn btn-primary btn-lg border fw-bold d-flex align-items-center justify-content-center gap-2 rounded-4 py-3" onClick={handleGoogleLogin} disabled={loading}>
                    <FaGoogle className="text-danger" /> Registrarse con Google
                  </button>
                  
                  <div className="position-relative text-center my-3">
                    <hr className="text-muted opacity-25" />
                    <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small">¿Ya tienes cuenta?</span>
                  </div>
                  
                  <button className="btn btn-outline-dark btn-lg fw-bold d-flex align-items-center justify-content-center gap-2 rounded-4 py-3" onClick={() => handleViewChange('login-email')}>
                    <FaLock /> Iniciar Sesión con Correo
                  </button>
                </div>
              </div>
            )}

            {/* VISTA DE REGISTRO CON EMAIL */}
            {view === 'register-email' && (
              <div className="auth-view-content animate__animated animate__fadeInRight">
                <button className="btn btn-link text-decoration-none text-muted fw-bold mb-3 p-0 d-flex align-items-center gap-2" onClick={() => handleViewChange('selection')}>
                  <FaArrowLeft /> Volver
                </button>
                <div className="auth-header mb-4">
                  <h2 className="fw-bold mb-1">Crear cuenta</h2>
                  <p className="text-muted">Completa tus datos para empezar</p>
                </div>
                
                {error && <div className="alert alert-danger rounded-4 py-2 px-3 mb-3 small">{error}</div>}

                <form className="auth-form d-flex flex-column gap-3" onSubmit={handleSubmit}>
                  <div className="input-group-auth">
                    <label className="form-label small fw-bold text-uppercase text-muted ms-1 mb-1">Nombre completo</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 rounded-start-4 ps-3"><FaUser className="text-muted" /></span>
                      <input type="text" className="form-control bg-light border-start-0 rounded-end-4 py-2" name="displayName" placeholder="Tu nombre" onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label className="form-label small fw-bold text-uppercase text-muted ms-1 mb-1">Número de teléfono</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 rounded-start-4 ps-3"><FaPhone className="text-muted" /></span>
                      <input type="tel" className="form-control bg-light border-start-0 rounded-end-4 py-2" name="phone" placeholder="+54 9..." onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label className="form-label small fw-bold text-uppercase text-muted ms-1 mb-1">Correo electrónico</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 rounded-start-4 ps-3"><FaEnvelope className="text-muted" /></span>
                      <input type="email" className="form-control bg-light border-start-0 rounded-end-4 py-2" name="email" placeholder="ejemplo@correo.com" onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label className="form-label small fw-bold text-uppercase text-muted ms-1 mb-1">Contraseña</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 rounded-start-4 ps-3"><FaLock className="text-muted" /></span>
                      <input type="password" className="form-control bg-light border-start-0 rounded-end-4 py-2" name="password" placeholder="••••••••" onChange={handleChange} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-dark btn-lg w-100 rounded-4 fw-bold mt-2 d-flex align-items-center justify-content-center gap-2" disabled={loading}>
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
              <div className="auth-view-content animate__animated animate__fadeInRight">
                <button className="btn btn-link text-decoration-none text-muted fw-bold mb-3 p-0 d-flex align-items-center gap-2" onClick={() => handleViewChange('selection')}>
                  <FaArrowLeft /> Volver
                </button>
                <div className="auth-header mb-4">
                  <h2 className="fw-bold mb-1">Bienvenido de nuevo</h2>
                  <p className="text-muted">Ingresa tus credenciales</p>
                </div>

                {error && <div className="alert alert-danger rounded-4 py-2 px-3 mb-3 small">{error}</div>}

                <form className="auth-form d-flex flex-column gap-3" onSubmit={handleSubmit}>
                  <div className="input-group-auth">
                    <label className="form-label small fw-bold text-uppercase text-muted ms-1 mb-1">Correo electrónico</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 rounded-start-4 ps-3"><FaEnvelope className="text-muted" /></span>
                      <input type="email" className="form-control bg-light border-start-0 rounded-end-4 py-2" name="email" placeholder="ejemplo@correo.com" onChange={handleChange} required />
                    </div>
                  </div>
                  <div className="input-group-auth">
                    <label className="form-label small fw-bold text-uppercase text-muted ms-1 mb-1">Contraseña</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 rounded-start-4 ps-3"><FaLock className="text-muted" /></span>
                      <input type="password" className="form-control bg-light border-start-0 rounded-end-4 py-2" name="password" placeholder="••••••••" onChange={handleChange} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-dark btn-lg w-100 rounded-4 fw-bold mt-2 d-flex align-items-center justify-content-center gap-2" disabled={loading}>
                    {loading ? 'Iniciando...' : (
                      <>
                        Entrar <FaChevronRight size={14} />
                      </>
                    )}
                  </button>
                </form>
                
                <div className="text-center mt-4">
                  <span className="text-muted">¿No tienes cuenta?</span> <button className="btn btn-link p-0 fw-bold text-decoration-none text-dark" onClick={() => handleViewChange('register-email')}>Regístrate aquí</button>
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
