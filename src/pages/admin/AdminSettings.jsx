import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FaCog, FaPercentage, FaSave, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const AdminSettings = () => {
  const [percentage, setPercentage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'general');
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.servicePercentage) {
            setPercentage(data.servicePercentage);
          }
        }
      } catch (error) {
        console.error("Error al obtener configuración:", error);
        setMessage({ type: 'danger', text: 'Error al cargar la configuración.' });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const value = parseInt(percentage);

    if (isNaN(value) || value < 1 || value > 90) {
      setMessage({ type: 'danger', text: 'El porcentaje debe ser un número entre 1 y 90.' });
      setSaving(false);
      return;
    }

    try {
      const settingsRef = doc(db, 'settings', 'general');
      await setDoc(settingsRef, { 
        servicePercentage: value,
        updatedAt: new Date()
      }, { merge: true });
      
      setMessage({ type: 'success', text: 'Porcentaje actualizado correctamente.' });
    } catch (error) {
      console.error("Error al guardar:", error);
      setMessage({ type: 'danger', text: 'Error al guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0">
      <h2 className="fw-bold mb-4">Configuración del Sistema</h2>
      
      <div className="row">
        <div className="col-md-6 col-lg-5">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-bottom-0 pt-4 px-4">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary">
                  <FaCog className="fs-4" />
                </div>
                <div>
                  <h5 className="fw-bold mb-0">Comisión del Servicio</h5>
                  <small className="text-muted">Ajuste de porcentaje global</small>
                </div>
              </div>
            </div>
            
            <div className="card-body p-4">
              <form onSubmit={handleSave}>
                <div className="mb-4">
                  <label htmlFor="percentage" className="form-label fw-medium text-secondary">
                    Porcentaje de Ganancia (%)
                  </label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text bg-light border-end-0">
                      <FaPercentage className="text-muted" />
                    </span>
                    <input
                      type="number"
                      className="form-control bg-light border-start-0"
                      id="percentage"
                      placeholder="Ej: 10"
                      min="1"
                      max="90"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-text mt-2">
                    <FaExclamationCircle className="me-1" />
                    Ingrese un valor entre 1 y 90. Este porcentaje se aplicará a todos los viajes.
                  </div>
                </div>

                {message.text && (
                  <div className={`alert alert-${message.type} d-flex align-items-center rounded-3 mb-4`} role="alert">
                    {message.type === 'success' ? (
                      <FaCheckCircle className="me-2 flex-shrink-0" />
                    ) : (
                      <FaExclamationCircle className="me-2 flex-shrink-0" />
                    )}
                    <div>{message.text}</div>
                  </div>
                )}

                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg rounded-pill fw-bold shadow-sm"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" /> Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-7 mt-4 mt-md-0">
          <div className="alert alert-info border-0 shadow-sm rounded-4 h-100">
            <h5 className="alert-heading fw-bold mb-3">
              <FaExclamationCircle className="me-2" />
              Información Importante
            </h5>
            <p>
              El porcentaje configurado aquí afectará el cálculo de ganancias para la plataforma y los conductores.
            </p>
            <hr />
            <p className="mb-0 small">
              <strong>Nota:</strong> Los cambios se aplicarán inmediatamente a los nuevos viajes generados. Los viajes en curso o finalizados mantendrán el porcentaje con el que fueron creados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
