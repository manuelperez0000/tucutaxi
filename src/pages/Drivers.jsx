import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { FaMapMarkerAlt, FaClock, FaCheck, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Drivers = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [price, setPrice] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Escuchar solicitudes pendientes y viajes activos del conductor
    const q = query(
      collection(db, 'taxiRequests'),
      where('status', 'in', ['pending', 'offered', 'accepted'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Si el conductor tiene una oferta activa o un viaje ya aceptado, redirigir a los detalles
      const activeRequest = docs.find(r => 
        (r.status === 'offered' || r.status === 'accepted') && r.driverId === user.uid
      );
      
      if (activeRequest) {
        navigate(`/trip/${activeRequest.id}`);
        return;
      }

      const pendingRequests = docs.filter(r => r.status === 'pending');

      // Verificar y cancelar solicitudes antiguas (más de 1 hora)
      const oneHourInMillis = 60 * 60 * 1000;
      const now = new Date();

      pendingRequests.forEach(async (request) => {
        if (request.createdAt) {
          // Manejar tanto Timestamp de Firestore como fechas JS si fuera el caso
          const createdAtDate = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
          const timeDiff = now - createdAtDate;

          if (timeDiff > oneHourInMillis) {
            try {
              await updateDoc(doc(db, 'taxiRequests', request.id), {
                status: 'cancelled'
              });
              console.log(`Solicitud ${request.id} cancelada automáticamente por inactividad.`);
            } catch (error) {
              console.error("Error al cancelar solicitud antigua:", error);
            }
          }
        }
      });

      setRequests(pendingRequests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid, navigate]);

  const handleAcceptRequest = (requestId) => {
    setSelectedRequest(requestId);
    setShowPriceModal(true);
  };

  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      alert("Por favor, ingresa un precio válido.");
      return;
    }

    setSendingOffer(true);
    try {
      // Intentar obtener la ubicación del conductor
      let driverLocation = null;
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          driverLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        } catch (geoError) {
          console.warn("No se pudo obtener la ubicación del conductor:", geoError);
        }
      }

      const requestRef = doc(db, 'taxiRequests', selectedRequest);
      await updateDoc(requestRef, {
        status: 'offered', // Cambiamos a 'offered' para que el pasajero apruebe
        price: parseFloat(price),
        driverId: user.uid,
        driverName: user.displayName,
        driverPhoto: user.photoURL,
        driverEmail: user.email,
        driverStartLocation: driverLocation,
        offeredAt: serverTimestamp()
      });

      setShowPriceModal(false);
      setPrice('');
      setSelectedRequest(null);
      
    } catch (error) {
      console.error("Error al enviar oferta:", error);
      alert("No se pudo enviar la oferta. Intenta de nuevo.");
    } finally {
      setSendingOffer(false);
    }
  };

  const handleViewLocation = (requestId) => {
    // Navegar a la página de detalle del viaje
    navigate(`/drive/${requestId}`);
  };

  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navbar user={user} />
      
      <main className="container-fluid py-4 flex-grow-1 px-3 px-md-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 fw-bold mb-0">Solicitudes Disponibles</h1>
          <span className="badge bg-warning text-dark px-3 py-2 rounded-pill shadow-sm">
            {requests.length} en espera
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="mt-2 text-muted">Buscando peticiones en tiempo real...</p>
          </div>
        ) : (
          <div className="row g-4">
            {requests.length === 0 ? (
              <div className="col-12 text-center py-5 bg-white rounded-4 shadow-sm border">
                <div className="mb-3">
                  <FaClock className="display-4 text-muted opacity-25" />
                </div>
                <h5 className="text-muted">No hay solicitudes por el momento</h5>
                <p className="small text-muted">Las nuevas peticiones aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden transition-hover">
                    <div className="card-body p-4 d-flex flex-column">
                      <div className="d-flex align-items-center gap-3 mb-3">
                        <img 
                          src={request.userPhoto || 'https://via.placeholder.com/50'} 
                          alt={request.userName || 'Usuario'} 
                          className="rounded-circle shadow-sm border"
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                        <div className="overflow-hidden">
                          <h6 className="mb-0 fw-bold text-truncate">{request.userName || 'Usuario'}</h6>
                          <small className="text-muted">
                            <FaClock className="me-1" />
                            {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recién ahora'}
                          </small>
                        </div>
                      </div>

                      <div className="bg-light p-3 rounded-3 mb-3 flex-grow-1">
                        <div className="d-flex align-items-start gap-2 mb-2">
                          <FaMapMarkerAlt className="text-danger mt-1 flex-shrink-0" />
                          <div className="overflow-hidden">
                            <p className="small fw-bold mb-1">Recogida:</p>
                            <p className="small text-muted mb-0 lh-sm text-truncate">
                              {request.address || 'Calculando...'}
                            </p>
                          </div>
                        </div>
                        <div className="d-flex align-items-start gap-2 pt-2 border-top">
                          <FaMapMarkerAlt className="text-primary mt-1 flex-shrink-0" />
                          <div className="overflow-hidden">
                            <p className="small fw-bold mb-1">Destino:</p>
                            <p className="small text-muted mb-0 lh-sm text-truncate">
                              {request.destination?.address || 'No especificado'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="d-grid gap-2 mt-auto">
                        <button 
                          className="btn btn-outline-primary py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                          onClick={() => handleViewLocation(request.id)}
                          style={{ borderRadius: '12px' }}
                        >
                          <FaMapMarkerAlt /> Ver Mapa
                        </button>
                        <button 
                          className="btn btn-dark py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                          onClick={() => handleAcceptRequest(request.id)}
                          style={{ borderRadius: '12px' }}
                        >
                          <FaCheck /> Aceptar Viaje
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal de Precio */}
      {showPriceModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Establecer Precio</h5>
                <button type="button" className="btn-close" onClick={() => setShowPriceModal(false)}></button>
              </div>
              <form onSubmit={handleSendOffer}>
                <div className="modal-body py-4 text-center">
                  <p className="text-muted mb-4">¿Cuánto quieres cobrar por este viaje?</p>
                  <div className="input-group input-group-lg mb-3 mx-auto" style={{ maxWidth: '250px' }}>
                    <span className="input-group-text bg-warning border-0 text-dark fw-bold">$</span>
                    <input 
                      type="number" 
                      className="form-control border-2 border-warning text-center fw-bold" 
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowPriceModal(false)}>Cancelar</button>
                  <button 
                    type="submit" 
                    className="btn btn-dark rounded-pill px-4 fw-bold"
                    disabled={sendingOffer}
                  >
                    {sendingOffer ? 'Enviando...' : 'Enviar Oferta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-3 bg-white border-top">
        <small className="text-muted">Modo Conductor Activo • tucutaxi</small>
      </footer>
    </div>
  );
};

export default Drivers;
