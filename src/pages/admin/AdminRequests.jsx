import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { FaUserCheck, FaCar, FaSpinner, FaCheckCircle, FaIdCard, FaPhone, FaEnvelope, FaInfoCircle } from 'react-icons/fa';

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      // Buscar usuarios que tienen vehículo pero no están aprobados como conductores
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('hasVehicle', '==', true), where('isDriverApproved', '==', false));
      const querySnapshot = await getDocs(q);

      const requestsData = await Promise.all(querySnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        let vehicleData = null;

        // Obtener datos del vehículo
        try {
          const vehicleDocRef = doc(db, 'vehicles', userDoc.id);
          const vehicleDocSnap = await getDoc(vehicleDocRef);
          if (vehicleDocSnap.exists()) {
            vehicleData = vehicleDocSnap.data();
          }
        } catch (err) {
          console.error(`Error fetching vehicle for user ${userDoc.id}:`, err);
        }

        return {
          id: userDoc.id,
          user: userData,
          vehicle: vehicleData
        };
      }));

      setRequests(requestsData);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    if (!window.confirm("¿Estás seguro de que deseas aprobar a este conductor?")) return;
    
    setProcessingId(userId);
    try {
      // 1. Aprobar al usuario como conductor
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isDriverApproved: true
      });

      // 2. Actualizar estado del vehículo a 'approved' (si existe el documento)
      const vehicleRef = doc(db, 'vehicles', userId);
      // Verificamos si existe antes de actualizar para evitar errores, aunque debería existir por la lógica de búsqueda
      const vehicleSnap = await getDoc(vehicleRef);
      if (vehicleSnap.exists()) {
        await updateDoc(vehicleRef, {
          status: 'approved'
        });
      }

      // Eliminar de la lista local
      setRequests(prev => prev.filter(req => req.id !== userId));
      alert("Conductor aprobado exitosamente.");

    } catch (error) {
      console.error("Error al aprobar conductor:", error);
      alert("Error al aprobar la solicitud. Inténtalo de nuevo.");
    } finally {
      setProcessingId(null);
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
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold m-0">Solicitudes Pendientes</h2>
          <p className="text-muted m-0 small">Conductores esperando aprobación: {requests.length}</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 py-5">
          <div className="card-body text-center">
            <div className="bg-light d-inline-flex p-4 rounded-circle mb-3">
              <FaCheckCircle className="text-success display-4 opacity-50" />
            </div>
            <h5 className="text-muted">No hay solicitudes pendientes</h5>
            <p className="text-muted small">Todos los conductores registrados han sido procesados.</p>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {requests.map((req) => (
            <div key={req.id} className="col-12 col-xl-6">
              <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                <div className="card-header bg-white border-bottom-0 pt-4 px-4 d-flex justify-content-between align-items-start">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary">
                      <FaUserCheck className="fs-4" />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0">{req.user.displayName || req.user.name || 'Usuario Sin Nombre'}</h5>
                      <span className="badge bg-warning text-dark rounded-pill px-2 py-1" style={{ fontSize: '0.7rem' }}>Pendiente</span>
                    </div>
                  </div>
                  <button 
                    className="btn btn-success rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
                    onClick={() => handleApprove(req.id)}
                    disabled={processingId === req.id}
                  >
                    {processingId === req.id ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle /> Aprobar
                      </>
                    )}
                  </button>
                </div>
                
                <div className="card-body px-4 pb-4">
                  <div className="row g-3">
                    {/* Información del Usuario */}
                    <div className="col-md-6">
                      <div className="bg-light p-3 rounded-4 h-100">
                        <h6 className="text-primary fw-bold mb-3 d-flex align-items-center gap-2">
                          <FaIdCard /> Datos Personales
                        </h6>
                        <ul className="list-unstyled mb-0 d-flex flex-column gap-2 small">
                          <li className="d-flex align-items-center gap-2">
                            <span className="text-muted w-25">Email:</span>
                            <span className="fw-medium text-break">{req.user.email}</span>
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <span className="text-muted w-25">Teléfono:</span>
                            <span className="fw-medium">{req.user.phone || 'No registrado'}</span>
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <span className="text-muted w-25">Cédula/DNI:</span>
                            <span className="fw-medium">{req.user.dni || req.user.cedula || 'No registrado'}</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Información del Vehículo */}
                    <div className="col-md-6">
                      <div className="bg-light p-3 rounded-4 h-100">
                        <h6 className="text-success fw-bold mb-3 d-flex align-items-center gap-2">
                          <FaCar /> Datos del Vehículo
                        </h6>
                        {req.vehicle ? (
                          <ul className="list-unstyled mb-0 d-flex flex-column gap-2 small">
                             <li className="d-flex align-items-center gap-2">
                              <span className="text-muted w-25">Tipo:</span>
                              <span className="fw-medium text-capitalize">{req.vehicle.type === 'motorcycle' ? 'Motocicleta' : 'Automóvil'}</span>
                            </li>
                            <li className="d-flex align-items-center gap-2">
                              <span className="text-muted w-25">Marca/Modelo:</span>
                              <span className="fw-medium">{req.vehicle.brand} {req.vehicle.model}</span>
                            </li>
                            <li className="d-flex align-items-center gap-2">
                              <span className="text-muted w-25">Año:</span>
                              <span className="fw-medium">{req.vehicle.year}</span>
                            </li>
                            <li className="d-flex align-items-center gap-2">
                              <span className="text-muted w-25">Placa:</span>
                              <span className="fw-medium">{req.vehicle.plate || 'No registrada'}</span>
                            </li>
                            {req.vehicle.type === 'car' && (
                              <>
                                <li className="d-flex align-items-center gap-2">
                                  <span className="text-muted w-25">Asientos:</span>
                                  <span className="fw-medium">{req.vehicle.seats}</span>
                                </li>
                                <li className="d-flex align-items-center gap-2">
                                  <span className="text-muted w-25">A/C:</span>
                                  <span className="fw-medium">{req.vehicle.ac ? 'Sí' : 'No'}</span>
                                </li>
                              </>
                            )}
                          </ul>
                        ) : (
                          <div className="text-center py-3 text-muted">
                            <FaInfoCircle className="mb-2" />
                            <p className="mb-0 small">Sin datos de vehículo</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRequests;
