import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { doc, onSnapshot, updateDoc, deleteField, serverTimestamp, getDoc } from 'firebase/firestore';
import { FaUser, FaMapMarkerAlt, FaClock, FaTimes, FaTaxi, FaPhoneAlt, FaCheckCircle, FaCar, FaDollarSign } from 'react-icons/fa';

const TripDetails = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const tripRef = doc(db, 'taxiRequests', id);
    const unsubscribe = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Si el viaje ya no está en estado de oferta ni aceptado por este conductor, redirigir
        if (!['offered', 'accepted'].includes(data.status) || data.driverId !== user.uid) {
          navigate('/drivers');
        }
        setTrip({ id: docSnap.id, ...data });

        // Fallback: Si falta el teléfono del usuario, buscarlo
        if (data.userId && !data.userPhone) {
             getDoc(doc(db, 'users', data.userId)).then(userDoc => {
                 if (userDoc.exists() && userDoc.data().phone) {
                     setTrip(prev => ({ ...prev, userPhone: userDoc.data().phone }));
                 }
             }).catch(console.error);
        }
      } else {
        navigate('/drivers');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, user.uid, navigate]);

  const handleReleaseTrip = async () => {
    if (!trip) return;

    const confirmRelease = window.confirm("¿Estás seguro de que quieres cancelar este viaje? Volverá a estar disponible para otros conductores.");
    if (!confirmRelease) return;

    try {
      const tripRef = doc(db, 'taxiRequests', trip.id);
      await updateDoc(tripRef, {
        status: 'pending',
        driverId: deleteField(),
        driverName: deleteField(),
        driverPhoto: deleteField(),
        driverEmail: deleteField(),
        driverStartLocation: deleteField(),
        price: deleteField(),
        acceptedAt: deleteField(),
        offeredAt: deleteField(),
        driverArrived: deleteField()
      });
      navigate('/drivers');
    } catch (error) {
      console.error("Error al liberar viaje:", error);
      alert("No se pudo liberar el viaje. Intenta de nuevo.");
    }
  };

  const handleDriverArrived = async () => {
    if (!trip) return;
    try {
      const tripRef = doc(db, 'taxiRequests', trip.id);
      await updateDoc(tripRef, {
        driverArrived: true,
        arrivedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error al notificar llegada:", error);
    }
  };

  const handleCompleteTrip = async () => {
    if (!trip) return;

    try {
      const tripRef = doc(db, 'taxiRequests', trip.id);
      await updateDoc(tripRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        commissionStatus:false
      });
      alert("¡Viaje completado con éxito!");
      navigate('/drivers');
    } catch (error) {
      console.error("Error al completar viaje:", error);
    }
  };

  const handleViewLocation = () => {
    if (trip?.location) {
      const url = `https://www.google.com/maps?q=${trip.location.latitude},${trip.location.longitude}`;
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar user={user} />
        <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
          <div className="spinner-border text-warning" role="status">
            <span className="visually-hidden">Cargando detalles...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navbar user={user} />
      
      <main className="container-fluid py-4 flex-grow-1 px-3 px-md-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6 col-xl-5">
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="bg-dark p-4 text-white text-center">
                <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                  <FaTaxi className="text-warning fs-4" />
                  <h4 className="mb-0 fw-bold">
                    {trip.status === 'offered' ? 'Oferta Enviada' : 'Viaje en Curso'}
                  </h4>
                </div>
                <div className="bg-warning text-dark px-4 py-3 rounded-4 shadow-sm border border-3 border-white d-inline-block">
                  <small className="text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>ID DE VIAJE</small>
                  <span className="display-4 fw-black m-0 p-0" style={{ fontFamily: 'monospace', letterSpacing: '3px' }}>
                    {trip.tripId}
                  </span>
                </div>
              </div>

              <div className="card-body p-4">
                {/* Botón para ir al mapa en Drive */}
                <div className="mb-4">
                  <button 
                    className="btn btn-primary w-100 py-3 rounded-4 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 animate__animated animate__pulse animate__infinite"
                    onClick={() => navigate(`/drive/${trip.id}`)}
                  >
                    <FaCar className="fs-4" />
                    <span>IR AL VIAJE EN CURSO (MAPA)</span>
                  </button>
                </div>

                {trip.status === 'offered' ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-warning mb-3" role="status"></div>
                    <p className="text-muted">Estamos esperando que el pasajero revise y acepte tu oferta de <strong>{trip.price > 0 ? `$${trip.price}` : 'GRATIS'}</strong>.</p>
                    <button 
                      onClick={handleReleaseTrip}
                      className="btn btn-outline-danger w-100 rounded-pill mt-3"
                    >
                      Retirar Oferta
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Información del Cliente */}
                    <div className="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded-4 border">
                      <img 
                        src={trip.userPhoto || 'https://via.placeholder.com/60'} 
                        alt={trip.userName} 
                        className="rounded-circle border shadow-sm"
                        style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                      />
                      <div className="flex-grow-1 overflow-hidden">
                        <h5 className="mb-0 fw-bold text-truncate">{trip.userName}</h5>
                        <small className="text-muted d-block">{trip.userEmail}</small>
                        {trip.userPhone && <small className="text-success fw-bold d-block">{trip.userPhone}</small>}
                      </div>
                      {trip.userPhone && (
                        <a href={`tel:${trip.userPhone}`} className="btn btn-dark rounded-circle p-3 shadow-sm">
                          <FaPhoneAlt />
                        </a>
                      )}
                    </div>

                    {/* Ubicación de Recogida y Destino */}
                    <div className="mb-4">
                      <div className="bg-white p-3 rounded-4 border shadow-sm mb-3">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <FaMapMarkerAlt className="text-danger" />
                          <span className="fw-bold text-dark">Recogida:</span>
                        </div>
                        <p className="small mb-2 text-muted lh-sm">{trip.address}</p>
                        <button 
                          onClick={handleViewLocation}
                          className="btn btn-outline-primary btn-sm w-100 rounded-pill py-2 fw-bold"
                        >
                          <FaMapMarkerAlt className="me-2" /> Abrir en Google Maps
                        </button>
                      </div>

                      <div className="bg-white p-3 rounded-4 border shadow-sm">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <FaMapMarkerAlt className="text-primary" />
                          <span className="fw-bold text-dark">Destino:</span>
                        </div>
                        <p className="small mb-2 text-muted lh-sm">{trip.destination?.address || 'No especificado'}</p>
                        {trip.destination && (
                          <button 
                            onClick={() => {
                              const url = `https://www.google.com/maps?q=${trip.destination.latitude},${trip.destination.longitude}`;
                              window.open(url, '_blank');
                            }}
                            className="btn btn-outline-info btn-sm w-100 rounded-pill py-2 fw-bold text-dark"
                          >
                            <FaMapMarkerAlt className="me-2" /> Ver Destino en Maps
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Precio del Viaje */}
                    <div className="bg-white p-3 rounded-4 border shadow-sm mb-4">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-light p-2 rounded-circle">
                                <FaDollarSign className="text-warning fs-4" />
                            </div>
                            <div>
                                <p className="small text-muted mb-0 fw-bold text-uppercase">Precio Acordado</p>
                                <p className="fw-black mb-0 text-success fs-3 lh-1">
                                    {trip.price > 0 ? `$${trip.price}` : 'GRATIS'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tiempo Transcurrido */}
                    <div className="d-flex align-items-center justify-content-between mb-4 px-2">
                      <div className="d-flex align-items-center gap-2 text-muted">
                        <FaClock />
                        <small>Aceptado a las: {trip.acceptedAt?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--:--'}</small>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="d-grid gap-3">
                      {!trip.driverArrived ? (
                        <button 
                          onClick={handleDriverArrived}
                          className="btn btn-warning py-3 fw-bold rounded-4 shadow-sm d-flex align-items-center justify-content-center gap-2"
                        >
                          <FaMapMarkerAlt /> He llegado al punto
                        </button>
                      ) : (
                        <div className="alert alert-success border-0 rounded-4 text-center fw-bold py-3 mb-0">
                          <FaCheckCircle className="me-2" /> ¡Has llegado al punto!
                        </div>
                      )}

                      <button 
                        onClick={handleCompleteTrip}
                        className="btn btn-success py-3 fw-bold rounded-4 shadow-sm d-flex align-items-center justify-content-center gap-2"
                      >
                        <FaCheckCircle /> Completar Viaje
                      </button>
                      <button 
                        onClick={handleReleaseTrip}
                        className="btn btn-outline-danger py-3 fw-bold rounded-4 d-flex align-items-center justify-content-center gap-2"
                      >
                        <FaTimes /> Cancelar / Liberar Viaje
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripDetails;
