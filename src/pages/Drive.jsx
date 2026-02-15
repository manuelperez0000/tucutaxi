import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import Navbar from '../components/Navbar';
import { FaArrowLeft, FaMapMarkerAlt, FaUser, FaClock, FaChevronDown, FaChevronUp, FaCar, FaLocationArrow } from 'react-icons/fa';
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

    useEffect(() => {
        const fetchTrip = async () => {
            try {
                const tripRef = doc(db, 'taxiRequests', id);
                const tripSnap = await getDoc(tripRef);

                if (tripSnap.exists()) {
                    setTrip({ id: tripSnap.id, ...tripSnap.data() });
                } else {
                    setError("El viaje no existe.");
                }
            } catch (err) {
                console.error("Error al obtener el viaje:", err);
                setError("Error al cargar la información del viaje.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchTrip();
        }
    }, [id]);

    // Función auxiliar para obtener ruta y comenzar navegación
    const fetchAndStartRoute = async (startLat, startLng, endLat, endLng) => {
        setDriverLocation([startLat, startLng]);
        setCarPosition([startLat, startLng]);

        try {
            // Llamada a OSRM para dibujar la ruta inicial
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
            );
            const data = await response.json();

            if (data.code === 'Ok' && data.routes.length > 0) {
                // OSRM devuelve [lon, lat], Leaflet necesita [lat, lon]
                const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                setRoute(coordinates);
                setIsNavigating(true);
                setIsMinimized(true); // Minimizar tarjeta automáticamente al iniciar
                
                // Iniciar seguimiento en tiempo real
                startRealtimeTracking(endLat, endLng);
            } else {
                alert("No se pudo calcular la ruta inicial.");
            }
        } catch (error) {
            console.error("Error al obtener ruta:", error);
            alert("Error de conexión al servicio de rutas.");
        }
    };

    // Función para iniciar la navegación
    const handleStartNavigation = () => {
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
                    trip.location.longitude
                );
            }, 
            (error) => {
                setLoadingLocation(false);
                console.error("Error al obtener ubicación:", error);
                
                let errorMsg = "No se pudo obtener tu ubicación actual.";
                
                // Manejo detallado de errores
                if (error.code === error.PERMISSION_DENIED) {
                    errorMsg = "Permiso de ubicación denegado. Por favor, habilita el acceso a la ubicación en tu navegador.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errorMsg = "La información de ubicación no está disponible.";
                } else if (error.code === error.TIMEOUT) {
                    errorMsg = "Se agotó el tiempo de espera para obtener la ubicación.";
                }

                alert(errorMsg);
            }, 
            options
        );
    };
    const startRealtimeTracking = (destLat, destLng) => {
        if (!navigator.geolocation) {
             console.error("Geolocalización no soportada");
             return;
        }

        // Limpiar cualquier watch anterior
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

        // Actualizar estado inicial en Firebase
        const updateFirebaseLocation = async (lat, lng, status = 'pickup_in_progress') => {
             try {
                const tripRef = doc(db, 'taxiRequests', id);
                await updateDoc(tripRef, { 
                    driverLocation: { latitude: lat, longitude: lng },
                    status: status
                });
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
                
                // Calcular distancia al destino (fórmula simple para distancias cortas)
                // Usando Haversine simplificado o distancia euclidiana aproximada
                // 1 grado de latitud ~ 111km. 0.0005 grados ~ 55 metros
                const latDiff = latitude - destLat;
                const lngDiff = longitude - destLng;
                const distanceSquared = (latDiff * latDiff) + (lngDiff * lngDiff);
                
                // Umbral de llegada: aprox 50-100 metros (0.0005^2 + 0.0005^2 = 0.0000005)
                const arrivalThreshold = 0.000001; 

                if (distanceSquared < arrivalThreshold) {
                    // Llegada
                    updateFirebaseLocation(latitude, longitude, 'driver_arrived');
                    if (watchIdRef.current !== null) {
                        navigator.geolocation.clearWatch(watchIdRef.current);
                        watchIdRef.current = null;
                    }
                    setIsNavigating(false);
                    alert("¡Has llegado al punto de recogida!");
                } else {
                    // En camino
                    updateFirebaseLocation(latitude, longitude);
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

    const destinationPosition = [
        trip.location?.latitude || 0,
        trip.location?.longitude || 0
    ];

    const mapCenter = carPosition || destinationPosition;

    return (
        <div className="d-flex flex-column vh-100">
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
                    
                    <MapUpdater center={carPosition || destinationPosition} zoom={15} />

                    {/* Marcador de destino */}
                    <Marker position={destinationPosition}>
                        <Popup>
                            {trip.address || 'Ubicación de recogida'}
                        </Popup>
                    </Marker>

                    {/* Ruta y Coche */}
                    {isNavigating && route.length > 0 && (
                        <>
                            <Polyline positions={route} color="blue" weight={5} opacity={0.7} />
                            {carPosition && (
                                <Marker position={carPosition} icon={carIcon} zIndexOffset={1000}>
                                    <Popup>Tu ubicación</Popup>
                                </Marker>
                            )}
                        </>
                    )}
                </MapContainer>

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

                                    <h5 className="card-title fw-bold mb-3">Detalles de Recogida</h5>
                                    
                                    <div className="d-flex align-items-center gap-3 mb-3">
                                        <div className="bg-light p-3 rounded-circle">
                                            <FaUser className="text-primary fs-4" />
                                        </div>
                                        <div>
                                            <p className="small text-muted mb-0">Pasajero</p>
                                            <h6 className="fw-bold mb-0">{trip.userName || 'Usuario'}</h6>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-start gap-3 mb-3">
                                        <div className="bg-light p-3 rounded-circle">
                                            <FaMapMarkerAlt className="text-danger fs-4" />
                                        </div>
                                        <div>
                                            <p className="small text-muted mb-0">Dirección de recogida</p>
                                            <p className="fw-medium mb-0">{trip.address || 'Ubicación seleccionada'}</p>
                                        </div>
                                    </div>

                                    <div className="d-grid gap-2">
                                        {!isNavigating ? (
                                            <button 
                                                className="btn btn-primary btn-lg rounded-pill shadow-sm"
                                                onClick={handleStartNavigation}
                                                disabled={loadingLocation}
                                            >
                                                {loadingLocation ? (
                                                    <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Obteniendo ubicación...</span>
                                                ) : (
                                                    <span><FaLocationArrow className="me-2" /> Ir al sitio</span>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="alert alert-info py-2 mb-0 text-center rounded-pill">
                                                <small>Navegando hacia el destino...</small>
                                            </div>
                                        )}
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
                                        {!isNavigating && (
                                             <button 
                                                className="btn btn-sm btn-primary rounded-circle"
                                                onClick={handleStartNavigation}
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