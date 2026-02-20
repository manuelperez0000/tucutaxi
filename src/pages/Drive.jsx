import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import Navbar from '../components/Navbar';
import { FaArrowLeft, FaMapMarkerAlt, FaUser, FaClock, FaChevronDown, FaChevronUp, FaCar, FaLocationArrow, FaCheckCircle, FaPhoneAlt } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icono personalizado para el coche
const carIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/741/741407.png', // Icono de coche visto desde arriba
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -10]
});

// Componente para centrar el mapa cuando cambia la ruta
const MapUpdater = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom);
        }
    }, [center, zoom, map]);
    return null;
};

const Drive = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    
    // Estados para navegación
    const [driverLocation, setDriverLocation] = useState(null);
    const [route, setRoute] = useState([]);
    const [isNavigating, setIsNavigating] = useState(false);
    const [carPosition, setCarPosition] = useState(null);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const watchIdRef = useRef(null);
    const [driverPhone, setDriverPhone] = useState(null);

    // Obtener teléfono del conductor
    useEffect(() => {
        const fetchDriverPhone = async () => {
            if (user?.uid) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        setDriverPhone(userDoc.data().phone);
                    }
                } catch (error) {
                    console.error("Error fetching driver phone:", error);
                }
            }
        };
        fetchDriverPhone();
    }, [user]);
    
    // Estados para oferta
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [offerPrice, setOfferPrice] = useState('');
    const [sendingOffer, setSendingOffer] = useState(false);
    
    // Estado para notificación de pasajero aceptado
    const [passengerAccepted, setPassengerAccepted] = useState(false);
    const previousStatusRef = useRef(null);

    useEffect(() => {
        if (!id) return;
        
        setLoading(true);
        const tripRef = doc(db, 'taxiRequests', id);
        
        const unsubscribe = onSnapshot(tripRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Detectar cambio a 'accepted' para mostrar notificación
                if (data.status === 'accepted' && previousStatusRef.current === 'offered') {
                    setPassengerAccepted(true);
                    // Ocultar notificación después de 5 segundos
                    setTimeout(() => setPassengerAccepted(false), 5000);
                }
                
                previousStatusRef.current = data.status;
                setTrip({ id: docSnap.id, ...data });
            } else {
                console.error("No se encontró el viaje");
                navigate('/drivers');
            }
            setLoading(false);
        }, (error) => {
            console.error("Error al obtener el viaje:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, navigate]);

    // Obtener ubicación inicial y seguimiento pasivo
    useEffect(() => {
        if (!navigator.geolocation) return;

        let watchId;
        
        // Si NO estamos navegando activamente, usamos un watch simple para mostrar la ubicación
        if (!isNavigating) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCarPosition([latitude, longitude]);
                    
                    // Si es la primera vez y no hay ubicación del conductor, la seteamos
                    if (!driverLocation) {
                        setDriverLocation([latitude, longitude]);
                    }
                },
                (error) => console.error("Error obteniendo ubicación:", error),
                { enableHighAccuracy: true }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [isNavigating]);

    // Función auxiliar para obtener ruta
    const getRoute = async (startLat, startLng, endLat, endLng) => {
        try {
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
            );
            const data = await response.json();
            if (data.code === 'Ok' && data.routes.length > 0) {
                return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
            }
        } catch (error) {
            console.error("Error al obtener ruta:", error);
        }
        return null;
    };

    // Calcular ruta de vista previa (Pickup -> Destination) al cargar el viaje
    useEffect(() => {
        if (trip && trip.location && trip.destination && !isNavigating) {
            const fetchPreview = async () => {
                const coords = await getRoute(
                    trip.location.latitude,
                    trip.location.longitude,
                    trip.destination.latitude,
                    trip.destination.longitude
                );
                if (coords) {
                    setRoute(coords);
                    // Ajustar mapa para mostrar toda la ruta
                    // (Esto se maneja parcialmente con MapUpdater si actualizamos center, pero idealmente bounds)
                }
            };
            fetchPreview();
        }
    }, [trip, isNavigating]);

    // Función auxiliar para obtener ruta y comenzar navegación
    const fetchAndStartRoute = async (startLat, startLng, endLat, endLng, ongoingStatus, arrivalStatus) => {
        setDriverLocation([startLat, startLng]);
        setCarPosition([startLat, startLng]);

        const coordinates = await getRoute(startLat, startLng, endLat, endLng);

        if (coordinates) {
            setRoute(coordinates);
            setIsNavigating(true);
            setIsMinimized(true); // Minimizar tarjeta automáticamente al iniciar
            
            // Iniciar seguimiento en tiempo real
            startRealtimeTracking(endLat, endLng, ongoingStatus, arrivalStatus);
        } else {
            alert("No se pudo calcular la ruta.");
        }
    };

    // Función para iniciar la navegación al punto de recogida
    const handleStartPickup = () => {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta geolocalización.");
            return;
        }

        setLoadingLocation(true);

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLoadingLocation(false);
                fetchAndStartRoute(
                    position.coords.latitude,
                    position.coords.longitude,
                    trip.location.latitude,
                    trip.location.longitude,
                    'accepted',
                    'driver_arrived'
                );
            }, 
            (error) => {
                setLoadingLocation(false);
                console.error("Error al obtener ubicación:", error);
                alert("No se pudo obtener tu ubicación actual.");
            }, 
            options
        );
    };

    // Función para iniciar el viaje al destino
    const handleStartTrip = () => {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta geolocalización.");
            return;
        }

        setLoadingLocation(true);
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLoadingLocation(false);
                fetchAndStartRoute(
                    position.coords.latitude,
                    position.coords.longitude,
                    trip.destination.latitude,
                    trip.destination.longitude,
                    'in_progress',
                    'completed'
                );
            }, 
            (error) => {
                setLoadingLocation(false);
                console.error("Error al obtener ubicación:", error);
                alert("No se pudo obtener tu ubicación actual.");
            }, 
            options
        );
    };

    // Función para finalizar el viaje manualmente
    const handleCompleteTrip = async () => {
        const confirmComplete = window.confirm("¿Confirmas que has finalizado el viaje?");
        if (!confirmComplete) return;

        try {
            const tripRef = doc(db, 'taxiRequests', id);
            
            // Lógica para determinar si la comisión está pagada
            // Por defecto es false (pago en efectivo, conductor debe comisión)
            // Si hubiera sistema de saldo/billetera, aquí se descontaría y se marcaría true
            const isCommissionPaid = false; 

            await updateDoc(tripRef, {
                status: 'completed',
                completedAt: new Date(), // Usar Date local o serverTimestamp importado
                commissionPaid: isCommissionPaid
            });
            
            // Detener navegación y seguimiento
            setIsNavigating(false);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            alert("¡Viaje finalizado exitosamente!");
        } catch (error) {
            console.error("Error al finalizar viaje:", error);
            alert("Error al finalizar el viaje. Intenta de nuevo.");
        }
    };

    const startRealtimeTracking = (destLat, destLng, ongoingStatus = 'pickup_in_progress', arrivalStatus = 'driver_arrived') => {
        if (!navigator.geolocation) {
             console.error("Geolocalización no soportada");
             return;
        }

        // Limpiar cualquier watch anterior
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

        // Actualizar estado en Firebase
        const updateFirebaseLocation = async (lat, lng, status) => {
             try {
                const tripRef = doc(db, 'taxiRequests', id);
                const updateData = { 
                    driverLocation: { latitude: lat, longitude: lng },
                    status: status
                };
                
                // Si el estado es completado, agregamos campos adicionales
                if (status === 'completed') {
                    updateData.completedAt = new Date();
                    updateData.commissionStatus = false; // Asumimos no pagado por defecto (efectivo)
                }

                await updateDoc(tripRef, updateData);
             } catch (err) { console.error("Error actualizando Firebase:", err); }
        };

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        const id_geo = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCarPosition([latitude, longitude]);
                
                const latDiff = latitude - destLat;
                const lngDiff = longitude - destLng;
                const distanceSquared = (latDiff * latDiff) + (lngDiff * lngDiff);
                
                // Umbral de llegada: aprox 50-100 metros
                const arrivalThreshold = 0.000001; 

                if (distanceSquared < arrivalThreshold) {
                    // Llegada
                    updateFirebaseLocation(latitude, longitude, arrivalStatus);
                    if (watchIdRef.current !== null) {
                        navigator.geolocation.clearWatch(watchIdRef.current);
                        watchIdRef.current = null;
                    }
                    setIsNavigating(false);
                    alert(arrivalStatus === 'driver_arrived' ? "¡Has llegado al punto de recogida!" : "¡Has llegado al destino!");
                } else {
                    // En camino
                    updateFirebaseLocation(latitude, longitude, ongoingStatus);
                }
            },
            (error) => console.error("Error en watchPosition:", error),
            options
        );
        watchIdRef.current = id_geo;
    };

    // Limpiar watch al desmontar
    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        };
    }, []);

    const handleSendOffer = async () => {
        if (!offerPrice || isNaN(offerPrice) || Number(offerPrice) <= 0) {
            alert("Por favor, ingresa un precio válido.");
            return;
        }

        setSendingOffer(true);
        try {
            const tripRef = doc(db, 'taxiRequests', id);
            await updateDoc(tripRef, {
                status: 'offered',
                price: offerPrice,
                driverId: user.uid,
                driverName: user.displayName || 'Conductor',
                driverPhoto: user.photoURL || '',
                driverEmail: user.email || '',
                driverPhone: driverPhone || '',
                driverLocation: carPosition ? { latitude: carPosition[0], longitude: carPosition[1] } : null
            });
            setShowPriceModal(false);
            // Actualizar estado local
            setTrip(prev => ({ ...prev, status: 'offered', price: offerPrice }));
        } catch (error) {
            console.error("Error al enviar oferta:", error);
            alert("Hubo un error al enviar la oferta.");
        } finally {
            setSendingOffer(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    if (error || !trip) {
        return (
            <div className="container py-5 text-center">
                <h3 className="text-danger">{error || "No se encontró el viaje"}</h3>
                <button className="btn btn-primary mt-3" onClick={() => navigate('/drivers')}>
                    Volver a solicitudes
                </button>
            </div>
        );
    }

    const mapCenter = carPosition || [trip.location.latitude, trip.location.longitude];

    return (
        <div className="d-flex flex-column vh-100">
            {/* Notificación de Pasajero Aceptado */}
            {passengerAccepted && (
                <div 
                    className="position-absolute top-0 start-50 translate-middle-x mt-5 alert alert-success d-flex align-items-center gap-3 shadow-lg rounded-4 animate__animated animate__bounceInDown" 
                    style={{ zIndex: 9999, width: '90%', maxWidth: '400px' }}
                >
                    <div className="bg-success text-white rounded-circle p-2 d-flex align-items-center justify-content-center">
                        <FaCheckCircle className="fs-4" />
                    </div>
                    <div>
                        <h6 className="fw-bold mb-0">¡Oferta Aceptada!</h6>
                        <small className="mb-0">El pasajero ha confirmado el viaje.</small>
                    </div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setPassengerAccepted(false)}></button>
                </div>
            )}

            <Navbar user={user} />
            
            <div className="flex-grow-1 position-relative" style={{ zIndex: 0 }}>
                <MapContainer 
                    center={mapCenter} 
                    zoom={15} 
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Actualizar mapa si hay navegación o cambio de foco */}
                    <MapUpdater center={isNavigating ? carPosition : { lat: trip.location.latitude, lng: trip.location.longitude }} zoom={14} />

                    {/* Marcador de Recogida (Inicio del viaje para el pasajero) */}
                    <Marker position={[trip.location.latitude, trip.location.longitude]}>
                        <Popup>
                            <strong>Recogida:</strong> {trip.address || 'Ubicación de recogida'}
                        </Popup>
                    </Marker>

                    {/* Marcador de Destino */}
                    {trip.destination && (
                        <Marker position={[trip.destination.latitude, trip.destination.longitude]}>
                            <Popup>
                                <strong>Destino:</strong> {trip.destination.address || 'Destino final'}
                            </Popup>
                        </Marker>
                    )}

                    {/* Ruta y Coche */}
                    {route.length > 0 && (
                        <>
                            {/* Ruta: Azul si es navegación activa, Gris/Verde si es preview */}
                            <Polyline 
                                positions={route} 
                                color={isNavigating ? "blue" : "green"} 
                                weight={5} 
                                opacity={0.7} 
                                dashArray={!isNavigating ? "10, 10" : null}
                            />
                            
                            {/* Mostrar coche siempre si tenemos la posición */}
                            {carPosition && (
                                <Marker position={carPosition} icon={carIcon} zIndexOffset={1000}>
                                    <Popup>Tu ubicación</Popup>
                                </Marker>
                            )}
                        </>
                    )}
                </MapContainer>

                {/* Modal de Precio */}
                {showPriceModal && (
                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="card border-0 shadow-lg rounded-4 p-4" style={{ width: '90%', maxWidth: '400px' }}>
                            <h4 className="fw-bold text-center mb-3">Proponer Precio</h4>
                            <div className="mb-3">
                                <label className="form-label text-muted">Precio del viaje ($)</label>
                                <input 
                                    type="number" 
                                    className="form-control form-control-lg fw-bold text-center" 
                                    placeholder="0"
                                    value={offerPrice}
                                    onChange={(e) => setOfferPrice(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="d-grid gap-2">
                                <button 
                                    className="btn btn-dark btn-lg rounded-pill fw-bold"
                                    onClick={handleSendOffer}
                                    disabled={sendingOffer || !offerPrice}
                                >
                                    {sendingOffer ? 'Enviando...' : 'Enviar Oferta'}
                                </button>
                                <button 
                                    className="btn btn-outline-secondary rounded-pill fw-bold"
                                    onClick={() => setShowPriceModal(false)}
                                    disabled={sendingOffer}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tarjeta de información superpuesta */}
                <div className="position-absolute bottom-0 start-0 w-100 p-3" style={{ zIndex: 1000, background: 'linear-gradient(to top, rgba(0,0,0,0.1), transparent)', pointerEvents: 'none' }}>
                    <div className="card border-0 shadow-lg rounded-4" style={{ pointerEvents: 'auto', transition: 'all 0.3s ease' }}>
                        <div className="card-body">
                            
                            {!isMinimized && (
                                <div className="animate__animated animate__fadeIn">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <button 
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => navigate('/drivers')}
                                        >
                                            <FaArrowLeft className="me-2" /> Volver
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-light rounded-circle shadow-sm"
                                            onClick={() => setIsMinimized(!isMinimized)}
                                            title={isMinimized ? "Expandir" : "Minimizar"}
                                        >
                                            {isMinimized ? <FaChevronUp /> : <FaChevronDown />}
                                        </button>
                                    </div>

                                    <h5 className="card-title fw-bold mb-3">
                                        {trip.status === 'pending' ? 'Solicitud de Viaje' : 'Detalles del Viaje'}
                                    </h5>
                                    
                                    <div className="d-flex align-items-center gap-3 mb-3">
                                        <div className="bg-light p-3 rounded-circle">
                                            <FaUser className="text-primary fs-4" />
                                        </div>
                                        <div className="flex-grow-1">
                                            <p className="small text-muted mb-0">Pasajero</p>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <h6 className="fw-bold mb-0">{trip.userName || 'Usuario'}</h6>
                                                {trip.userPhone && (
                                                    <a href={`tel:${trip.userPhone}`} className="btn btn-sm btn-success rounded-circle p-2 shadow-sm">
                                                        <FaPhoneAlt size={14} />
                                                    </a>
                                                )}
                                            </div>
                                            {trip.userPhone && <small className="text-muted d-block">{trip.userPhone}</small>}
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-start gap-3 mb-3">
                                        <div className="bg-light p-3 rounded-circle">
                                            <FaMapMarkerAlt className="text-danger fs-4" />
                                        </div>
                                        <div>
                                            <p className="small text-muted mb-0">Desde:</p>
                                            <p className="fw-medium mb-0">{trip.address || 'Ubicación seleccionada'}</p>
                                        </div>
                                    </div>

                                    {trip.destination && (
                                        <div className="d-flex align-items-start gap-3 mb-3">
                                            <div className="bg-light p-3 rounded-circle">
                                                <FaLocationArrow className="text-success fs-4" />
                                            </div>
                                            <div>
                                                <p className="small text-muted mb-0">Hasta:</p>
                                                <p className="fw-medium mb-0">{trip.destination.address || 'Destino final'}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="d-grid gap-2">
                                        {trip.status === 'pending' ? (
                                            <button 
                                                className="btn btn-success btn-lg rounded-pill shadow-sm fw-bold"
                                                onClick={() => setShowPriceModal(true)}
                                            >
                                                Aceptar Carrera
                                            </button>
                                        ) : trip.status === 'offered' ? (
                                            <div className="alert alert-warning text-center rounded-pill fw-bold mb-0">
                                                Esperando respuesta del pasajero... (${trip.price})
                                            </div>
                                        ) : trip.status === 'accepted' ? (
                                            !isNavigating ? (
                                                <button 
                                                    className="btn btn-primary btn-lg rounded-pill shadow-sm"
                                                    onClick={handleStartPickup}
                                                    disabled={loadingLocation}
                                                >
                                                    {loadingLocation ? (
                                                        <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Obteniendo ubicación...</span>
                                                    ) : (
                                                        <span><FaLocationArrow className="me-2" /> Ir a recoger</span>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="alert alert-info py-2 mb-0 text-center rounded-pill">
                                                    <small>Navegando hacia el punto de recogida...</small>
                                                </div>
                                            )
                                        ) : trip.status === 'driver_arrived' ? (
                                            !isNavigating ? (
                                                <button 
                                                    className="btn btn-success btn-lg rounded-pill shadow-sm"
                                                    onClick={handleStartTrip}
                                                    disabled={loadingLocation}
                                                >
                                                    {loadingLocation ? (
                                                        <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Iniciando...</span>
                                                    ) : (
                                                        <span><FaCar className="me-2" /> Iniciar Viaje</span>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="alert alert-info py-2 mb-0 text-center rounded-pill">
                                                    <small>Iniciando viaje...</small>
                                                </div>
                                            )
                                        ) : trip.status === 'in_progress' ? (
                                             <div className="d-grid gap-2">
                                                 {!isNavigating ? (
                                                    <button 
                                                        className="btn btn-primary btn-lg rounded-pill shadow-sm"
                                                        onClick={handleStartTrip}
                                                        disabled={loadingLocation}
                                                    >
                                                        {loadingLocation ? (
                                                            <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Reanudando...</span>
                                                        ) : (
                                                            <span><FaLocationArrow className="me-2" /> Continuar Navegación</span>
                                                        )}
                                                    </button>
                                                 ) : (
                                                    <div className="alert alert-primary py-2 mb-0 text-center rounded-pill">
                                                        <small>En viaje hacia el destino...</small>
                                                    </div>
                                                 )}
                                                 
                                                 <button 
                                                    className="btn btn-success btn-lg rounded-pill shadow-sm fw-bold"
                                                    onClick={handleCompleteTrip}
                                                 >
                                                    <FaCheckCircle className="me-2" /> Finalizar Viaje
                                                 </button>
                                             </div>
                                        ) : trip.status === 'completed' ? (
                                             <div className="alert alert-success py-2 mb-0 text-center rounded-pill">
                                                <small>¡Viaje finalizado!</small>
                                             </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                            
                            {isMinimized && (
                                <div className="d-flex align-items-center justify-content-between animate__animated animate__fadeIn">
                                    <div className="d-flex align-items-center gap-2">
                                        <FaMapMarkerAlt className="text-danger" />
                                        <span className="fw-bold text-truncate" style={{ maxWidth: '200px' }}>
                                            {trip.address || 'Ubicación seleccionada'}
                                        </span>
                                    </div>
                                    <div className="d-flex gap-2">
                                        {!isNavigating && trip.status === 'accepted' && (
                                             <button 
                                                className="btn btn-sm btn-primary rounded-circle"
                                                onClick={handleStartPickup}
                                                title="Ir al sitio"
                                                disabled={loadingLocation}
                                            >
                                                {loadingLocation ? (
                                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                ) : (
                                                    <FaLocationArrow />
                                                )}
                                            </button>
                                        )}
                                        {!isNavigating && trip.status === 'driver_arrived' && (
                                             <button 
                                                className="btn btn-sm btn-success rounded-circle"
                                                onClick={handleStartTrip}
                                                title="Iniciar Viaje"
                                                disabled={loadingLocation}
                                            >
                                                {loadingLocation ? (
                                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                ) : (
                                                    <FaCar />
                                                )}
                                            </button>
                                        )}
                                        <button 
                                            className="btn btn-sm btn-light rounded-circle shadow-sm"
                                            onClick={() => setIsMinimized(!isMinimized)}
                                            title="Expandir"
                                        >
                                            <FaChevronUp />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Drive;