import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FaUser, FaPhone, FaSave, FaCheckCircle, FaSpinner, FaIdCard } from 'react-icons/fa';

const Profile = ({ user }) => {
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    phone: '',
    dni: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setFormData({
            displayName: data.displayName || user.displayName || '',
            phone: data.phone || '',
            dni: data.dni || '',
          });
        }
      } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const updateData = {
        displayName: formData.displayName,
        phone: formData.phone,
        dni: formData.dni,
        email: user.email,
        photoURL: user.photoURL,
        updatedAt: serverTimestamp()
      };

      if (userSnap.exists()) {
        await updateDoc(userRef, updateData);
      } else {
        await setDoc(userRef, {
          ...updateData,
          createdAt: serverTimestamp(),
          uid: user.uid
        });
      }

      setMessage({ type: 'success', text: '¡Perfil actualizado con éxito!' });
    } catch (error) {
      console.error("Error al guardar perfil:", error);
      setMessage({ type: 'danger', text: 'Error al guardar los cambios. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar user={user} />
        <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
          <div className="spinner-border text-warning" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100">
      <Navbar user={user} />
      
      <main className="container py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="bg-dark p-3 text-center text-white">
                <div className="position-relative d-inline-block mb-2">
                  {user?.photoURL ? (
                    <> 
                    <img 
                      src={user.photoURL} 
                      className="rounded-circle border border-4 border-warning shadow" 
                      style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                      />
                      
                      </>
                    
                  ) : (
                    <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '120px', height: '120px' }}>
                      <FaUser className="text-white display-4" />
                    </div>
                  )}
                </div>
                <h3 className="fw-bold mb-0">{formData.displayName || 'Mi Perfil'}</h3>
                <p className="text-muted small mb-0">{user?.email}</p>
              </div>

              <div className="card-body p-4 p-md-5">
                {message.text && (
                  <div className={`alert alert-${message.type} d-flex align-items-center gap-2 rounded-4 mb-4`} role="alert">
                    {message.type === 'success' ? <FaCheckCircle /> : null}
                    {message.text}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-bold text-muted small text-uppercase ls-1">Nombre Completo</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><FaUser className="text-muted" /></span>
                      <input 
                        type="text" 
                        name="displayName"
                        className="form-control bg-light border-0 py-3" 
                        placeholder="Ingresa tu nombre"
                        value={formData.displayName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-bold text-muted small text-uppercase ls-1">Cédula de Identidad</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><FaIdCard className="text-muted" /></span>
                      <input 
                        type="text" 
                        name="dni"
                        className="form-control bg-light border-0 py-3" 
                        placeholder="Ingresa tu cédula"
                        value={formData.dni}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-bold text-muted small text-uppercase ls-1">Teléfono de Contacto</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><FaPhone className="text-muted" /></span>
                      <input 
                        type="tel" 
                        name="phone"
                        className="form-control bg-light border-0 py-3" 
                        placeholder="Ej: +54 9 11 1234 5678"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-warning w-100 py-3 fw-bold rounded-pill shadow-sm d-flex align-items-center justify-content-center gap-2"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <FaSpinner className="spinner-border spinner-border-sm border-0" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <FaSave /> Guardar Cambios
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
