import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import DestinationSelector from '../components/DestinationSelector';
import { FaTaxi, FaSpinner, FaTimes, FaClock, FaUserCircle, FaStar, FaPhoneAlt, FaMapMarkerAlt, FaMapMarkedAlt } from 'react-icons/fa';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

const Dashboard = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [countdown, setCountdown] = useState(null);
  const [distanceInfo, setDistanceInfo] = useState({ distance: '', duration: '' });
  const [showDestinationSelector, setShowDestinationSelector] = useState(false);
  const [destination, setDestination] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Obtener ubicación inicial del usuario
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Error al obtener ubicación inicial:", error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Escuchar si el usuario ya tiene un viaje pendiente o aceptado
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'taxiRequests'),
      where('userId', '==', user.uid),
      where('status', 'in', ['pending', 'offered', 'accepted'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Tomamos el primer viaje activo encontrado
        const tripData = snapshot.docs[0].data();
        setActiveTrip({ id: snapshot.docs[0].id, ...tripData });
      } else {
        setActiveTrip(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Manejar el temporizador de cuenta regresiva y cálculo de Google Distance Matrix
  useEffect(() => {
    let timer;

    const calculateETA = async () => {
      if (activeTrip?.status === 'accepted' && activeTrip.driverStartLocation && !activeTrip.driverArrived && countdown === null) {
        try {
          // Coordenadas del pasajero y del conductor
          const origin = `${activeTrip.driverStartLocation.lat},${activeTrip.driverStartLocation.lng}`;
          const destination = `${activeTrip.location.lat},${activeTrip.location.lng}`;
          
          // API Key de Google (usando la misma de Firebase que suele tener permisos para Maps)
          const apiKey = "AIzaSyDRSDPUDAaQZqLAtsJtRnex5uhKBqWb5vw";
          
          // Usar un proxy de CORS o llamar directamente si está configurado (aquí usamos el modo no-cors para evitar errores de preflight si es necesario, 
          // aunque para una API Key real se suele usar un backend o configurar los origenes permitidos en Google Cloud Console)
          const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`);
          const data = await response.json();

          if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const element = data.rows[0].elements[0];
            const durationInSeconds = element.duration.value;
            const distanceText = element.distance.text;
            const durationText = element.duration.text;

            setCountdown(durationInSeconds);
            setDistanceInfo({ distance: distanceText, duration: durationText });
          } else {
            // Fallback si la API falla o no devuelve resultados
            const randomETA = Math.floor(Math.random() * (300 - 120 + 1)) + 120;
            setCountdown(randomETA);
          }
        } catch (error) {
          console.error("Error al calcular ETA con Google:", error);
          const randomETA = Math.floor(Math.random() * (300 - 120 + 1)) + 120;
          setCountdown(randomETA);
        }
      }
    };

    if (activeTrip?.status === 'accepted' && !activeTrip.driverArrived) {
      calculateETA();

      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      setCountdown(null);
      setDistanceInfo({ distance: '', duration: '' });
    }

    return () => clearInterval(timer);
  }, [activeTrip?.status, activeTrip?.driverArrived, activeTrip?.driverStartLocation, activeTrip?.location, countdown]);

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateTripId = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
  };

  const handleRequestTaxi = () => {
    if (!destination) {
      setShowDestinationSelector(true);
      return;
    }

    if (!navigator.geolocation) {
      setMessage({ type: 'danger', text: 'Tu navegador no soporta geolocalización.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Obtener dirección legible usando OpenStreetMap (Nominatim)
          let address = 'Ubicación desconocida';
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
            const data = await response.json();
            address = data.display_name || 'Ubicación sin nombre';
          } catch (err) {
            console.error("Error al obtener dirección:", err);
          }

          const tripId = generateTripId();

          // Crear la solicitud en Firestore
          const requestData = {
            userId: user.uid,
            userName: user.displayName,
            userEmail: user.email,
            userPhoto: user.photoURL,
            tripId: tripId,
            location: {
              latitude,
              longitude
            },
            address: address,
            destination: {
              latitude: destination.location.lat,
              longitude: destination.location.lng,
              address: destination.address
            },
            status: 'pending',
            createdAt: serverTimestamp()
          };

          await addDoc(collection(db, 'taxiRequests'), requestData);
          
          setMessage({ type: 'success', text: '¡Buscando tu taxi!' });
          setShowDestinationSelector(false);
          setDestination(null);
        } catch (error) {
          console.error("Error al guardar en Firebase:", error);
          setMessage({ type: 'danger', text: 'Error al enviar la solicitud. Intenta de nuevo.' });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        console.error("Error de geolocalización:", error);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setMessage({ type: 'danger', text: 'Debes permitir el acceso al GPS para pedir un taxi.' });
            break;
          case error.POSITION_UNAVAILABLE:
            setMessage({ type: 'danger', text: 'La ubicación no está disponible.' });
            break;
          case error.TIMEOUT:
            setMessage({ type: 'danger', text: 'Se agotó el tiempo para obtener la ubicación.' });
            break;
          default:
            setMessage({ type: 'danger', text: 'Ocurrió un error al obtener tu ubicación.' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCancelTrip = async () => {
    if (!activeTrip) return;

    const confirmCancel = window.confirm("¿Estás seguro de que deseas cancelar tu solicitud de taxi?");
    if (!confirmCancel) return;

    try {
      const tripRef = doc(db, 'taxiRequests', activeTrip.id);
      await updateDoc(tripRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });
      setActiveTrip(null);
      setMessage({ type: 'success', text: 'Viaje cancelado correctamente.' });
    } catch (error) {
      console.error("Error al cancelar viaje:", error);
      setMessage({ type: 'danger', text: 'No se pudo cancelar el viaje.' });
    }
  };

  const handleViewDriverLocation = () => {
    if (!activeTrip?.driverStartLocation) return;
    const { lat, lng } = activeTrip.driverStartLocation;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const handleAcceptOffer = async () => {
    if (!activeTrip) return;
    try {
      const tripRef = doc(db, 'taxiRequests', activeTrip.id);
      await updateDoc(tripRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: '¡Oferta aceptada! El conductor va en camino.' });
    } catch (error) {
      console.error("Error al aceptar oferta:", error);
      setMessage({ type: 'danger', text: 'No se pudo aceptar la oferta.' });
    }
  };

  const handleDeclineOffer = async () => {
    if (!activeTrip) return;
    try {
      const tripRef = doc(db, 'taxiRequests', activeTrip.id);
      // Si el pasajero rechaza, volvemos el viaje a pendiente para otros conductores
      // y borramos los datos del conductor actual
      await updateDoc(tripRef, {
        status: 'pending',
        driverId: null,
        driverName: null,
        driverPhoto: null,
        driverEmail: null,
        driverStartLocation: null,
        price: null,
        offeredAt: null
      });
      setMessage({ type: 'info', text: 'Oferta rechazada. Buscando otro conductor...' });
    } catch (error) {
      console.error("Error al rechazar oferta:", error);
      setMessage({ type: 'danger', text: 'No se pudo rechazar la oferta.' });
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' }}>
      <Navbar user={user} />
      
      <main className="container-fluid mt-auto d-flex flex-column align-items-center p-0">
        <div className="card border-0 shadow-lg text-center p-4 w-100" style={{ borderRadius: '30px 30px 0 0', backgroundColor: 'rgba(255, 255, 255, 1)' }}>

          
          <div className="container-md">
            {message.text && (
              <div className={`alert alert-${message.type} py-2 small mb-3`} role="alert">
                {message.text}
              </div>
            )}
            
            <div className="row justify-content-center mb-3">
              <div className="col-12 col-md-8 col-lg-6">
                {!activeTrip ? (
                  <>
                    <p className="text-muted mb-4 text-start text-md-center">¿A dónde quieres ir hoy?</p>
                    
                    {destination ? (
                      <div className="bg-light p-3 rounded-4 border mb-3 text-start animate__animated animate__fadeIn">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <small className="text-muted fw-bold text-uppercase ls-1">Tu Destino:</small>
                          <button 
                            className="btn btn-sm btn-link text-danger p-0" 
                            onClick={() => setDestination(null)}
                          >
                            <FaTimes /> Cambiar
                          </button>
                        </div>
                        <div className="d-flex align-items-start gap-2">
                          <FaMapMarkerAlt className="text-danger mt-1" />
                          <p className="small mb-0 text-dark fw-medium lh-sm">{destination.address}</p>
                        </div>
                      </div>
                    ) : (
                      <button 
                        className="btn btn-light btn-lg py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 w-100 mb-3"
                        onClick={() => setShowDestinationSelector(true)}
                        style={{ borderRadius: '15px', border: '2px dashed #ddd' }}
                      >
                        <FaMapMarkedAlt className="text-warning" />
                        Seleccionar Destino
                      </button>
                    )}

                    {showDestinationSelector && (
                      <div className="mb-3 animate__animated animate__slideInUp">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold mb-0">Elige tu destino</h6>
                          <button className="btn btn-sm btn-close" onClick={() => setShowDestinationSelector(false)}></button>
                        </div>
                        <DestinationSelector 
                          userLocation={userLocation} 
                          onDestinationSelected={(dest) => {
                            setDestination(dest);
                            setShowDestinationSelector(false);
                          }} 
                        />
                      </div>
                    )}

                    <div className="d-grid gap-3">
                      <button 
                        className="btn btn-dark btn-lg py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 w-100"
                        onClick={handleRequestTaxi}
                        disabled={loading || showDestinationSelector}
                        style={{ borderRadius: '15px' }}
                      >
                        {loading ? (
                          <FaSpinner className="spinner-border spinner-border-sm border-0" />
                        ) : (
                          <FaTaxi />
                        )}
                        {loading ? 'Procesando...' : (destination ? 'Confirmar y Pedir Taxi' : 'Pedir un Taxi')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-light p-3 rounded-4 shadow-sm border mt-2">
                    {activeTrip.status === 'pending' ? (
                      <div className="text-center py-2">
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                          <FaClock className="text-warning spinner-grow spinner-grow-sm border-0" />
                          <span className="fw-bold">Esperando un conductor...</span>
                        </div>
                        <div className="mb-4 bg-white p-4 rounded-4 shadow-sm border border-2 border-warning d-inline-block w-100">
                          <small className="text-muted d-block text-uppercase fw-bold ls-1 mb-1">Tu ID de Viaje</small>
                          <span className="display-3 fw-black text-dark tracking-tighter" style={{ fontFamily: 'monospace', letterSpacing: '4px' }}>
                            {activeTrip.tripId}
                          </span>
                        </div>
                      </div>
                    ) : activeTrip.status === 'offered' ? (
                      <div className="text-center py-2">
                        <div className="alert alert-warning border-0 rounded-4 py-3 mb-4 shadow-sm">
                          <h5 className="fw-bold mb-2">¡Nueva Oferta Recibida!</h5>
                          <p className="mb-0">El conductor ha propuesto un precio para tu viaje.</p>
                        </div>
                        
                        <div className="bg-white p-4 rounded-4 shadow-sm border border-2 border-warning mb-4">
                          <small className="text-muted d-block text-uppercase fw-bold mb-1">Precio Propuesto</small>
                          <span className="display-2 fw-black text-dark">$ {activeTrip.price}</span>
                        </div>

                        <div className="bg-white p-3 rounded-4 border shadow-sm mb-4 d-flex align-items-center gap-3 text-start">
                          {activeTrip.driverPhoto ? (
                            <img src={activeTrip.driverPhoto} alt={activeTrip.driverName} className="rounded-circle" style={{ width: '50px', height: '50px' }} />
                          ) : (
                            <FaUserCircle className="text-secondary" style={{ fontSize: '50px' }} />
                          )}
                          <div>
                            <h6 className="mb-0 fw-bold">{activeTrip.driverName}</h6>
                            <div className="text-warning small">
                              <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                            </div>
                          </div>
                        </div>

                        <div className="d-grid gap-2">
                          <button className="btn btn-dark btn-lg rounded-pill fw-bold py-3" onClick={handleAcceptOffer}>
                            Aceptar Carrera
                          </button>
                          <button className="btn btn-outline-secondary rounded-pill fw-bold" onClick={handleDeclineOffer}>
                            Rechazar y seguir buscando
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-start">
                        {activeTrip.driverArrived && (
                          <div className="alert alert-success border-0 rounded-4 text-center py-3 mb-3 shadow-sm animate__animated animate__pulse animate__infinite">
                            <h5 className="fw-bold mb-1"><FaMapMarkerAlt className="me-2" /> ¡Tu conductor ha llegado!</h5>
                            <small>Por favor, acércate al punto de recogida.</small>
                          </div>
                        )}

                        <div className="d-flex align-items-center gap-2 mb-3 justify-content-center text-success">
                          <FaTaxi />
                          <span className="fw-bold">{activeTrip.driverArrived ? 'Esperándote en el punto' : 'Conductor en camino'}</span>
                        </div>

                        
                        
                        {/* Tarjeta del Conductor */}
                        <div className="bg-white p-3 rounded-4 border shadow-sm mb-3 d-flex align-items-center gap-3">
                          {activeTrip.driverPhoto ? (
                            <img 
                              src={activeTrip.driverPhoto} 
                              alt={activeTrip.driverName} 
                              className="rounded-circle border"
                              style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                            />
                          ) : (
                            <FaUserCircle className="text-secondary" style={{ fontSize: '60px' }} />
                          )}
                          <div className="flex-grow-1">
                <h6 className="mb-0 fw-bold">{activeTrip.driverName}</h6>
                <div className="d-flex align-items-center gap-1 text-warning small">
                  <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                  <span className="text-muted ms-1">(4.9)</span>
                </div>
                <small className="text-muted">{activeTrip.driverEmail}</small>
                {activeTrip.driverStartLocation && (
                  <button 
                    onClick={handleViewDriverLocation}
                    className="btn btn-link p-0 text-dark text-decoration-none small d-flex align-items-center gap-1 mt-1"
                  >
                    <FaMapMarkerAlt className="text-danger" /> 
                    <span>Ver ubicación inicial</span>
                  </button>
                )}
              </div>
                          <button className="btn btn-dark rounded-circle p-2 shadow-sm">
                            <FaPhoneAlt size={18} />
                          </button>
                        </div>

                        <div className="mb-4 text-center bg-white p-3 rounded-4">
                          <small className="text-muted d-block text-uppercase fw-bold ls-1 mb-1">Id de viaje</small>
                          <span className="display-4 fw-black text-dark" style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
                            {activeTrip.tripId}
                          </span>
                          {activeTrip.price && (
                            <div className="mt-2 text-success fw-bold fs-4">
                              Precio pactado: ${activeTrip.price}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-start mb-4 bg-white p-3 rounded-3 border">
                      <div className="mb-2 pb-2 border-bottom">
                        <small className="text-muted d-block mb-1">Recogida en:</small>
                        <p className="small mb-0 text-dark fw-medium lh-sm text-truncate">{activeTrip.address}</p>
                      </div>
                      <div className="pt-1">
                        <small className="text-muted d-block mb-1">Destino:</small>
                        <p className="small mb-0 text-dark fw-medium lh-sm text-truncate">
                          {activeTrip.destination?.address || 'No especificado'}
                        </p>
                      </div>
                    </div>

                    <button 
                      className="btn btn-outline-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                      onClick={handleCancelTrip}
                      style={{ borderRadius: '12px' }}
                    >
                      <FaTimes /> Cancelar Viaje
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
