
import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { FaTaxi, FaSpinner, FaTimes, FaClock, FaUserCircle, FaStar, FaPhoneAlt, FaMapMarkerAlt, FaMapMarkedAlt, FaCar, FaSearch, FaIdCard, FaMotorcycle, FaTruck, FaCheckCircle } from 'react-icons/fa';
import useDashboard from '../hooks/useDashboadr';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icono de auto para el conductor
const carIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/741/741407.png',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -10]
});

// Componente para manejar eventos del mapa
const MapEvents = ({ activeField, onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (activeField) {
        onLocationSelect(e.latlng);
      }
    },
  });
  return null;
};

// Componente para actualizar la vista del mapa
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  return null;
};

// Componente para ajustar los límites del mapa a la ruta
const RouteFitter = ({ route }) => {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [route, map]);
  return null;
};

// Componente para el marcador del conductor
const DriverMarker = ({ activeTrip }) => {
  if (!activeTrip || !['accepted', 'driver_arrived', 'in_progress'].includes(activeTrip.status)) return null;

  const lat = activeTrip.driverLocation?.latitude || activeTrip.driverStartLocation?.lat;
  const lng = activeTrip.driverLocation?.longitude || activeTrip.driverStartLocation?.lng;
  
  if (!lat || !lng) return null;

  return (
    <Marker position={[lat, lng]} icon={carIcon} zIndexOffset={1000}>
      <Popup>
        <div className="text-center">
          <strong>{activeTrip.driverName || 'Conductor'}</strong><br/>
          <small>{activeTrip.status === 'driver_arrived' ? '¡Ha llegado!' : 'En camino'}</small>
        </div>
      </Popup>
    </Marker>
  );
};

// Componente para la línea de ruta
const RoutePolyline = ({ route }) => {
    if (!route || route.length === 0) return null;
    return <Polyline positions={route} color="blue" weight={5} opacity={0.7} />;
};

const Dashboard = ({ user }) => {
  const {
    loading,
    activeTrip,
    message,
    showDestinationSelector,
    setShowDestinationSelector,
    destination,
    setDestination,
    userLocation,
    handleCancelTrip,
    handleRequestTaxi,
    handleViewDriverLocation,
    handleAcceptOffer,
    handleDeclineOffer,
    pickupLocation,
    setPickupLocation,
    locationError,
    userPhone,
    userName,
    userDni,
    fetchingProfile,
    updateUserProfile
  } = useDashboard({ user });

  const [activeField, setActiveField] = useState('pickup'); // 'pickup' | 'destination' | null
  
  // Estado para el modal de completar perfil
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDni, setProfileDni] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!fetchingProfile && user) {
        // Si no tiene teléfono o DNI, mostrar modal
        if (!userPhone || !userDni) {
            setShowProfileModal(true);
            setProfileName(userName || user.displayName || '');
            setProfilePhone(userPhone || '');
            setProfileDni(userDni || '');
        } else {
            setShowProfileModal(false);
        }
    }
  }, [fetchingProfile, user, userPhone, userName, userDni]);

  const handleSaveProfile = async (e) => {
      e.preventDefault();
      if (!profileName.trim() || !profilePhone.trim() || !profileDni.trim()) {
          alert("Por favor completa todos los campos");
          return;
      }
      setSavingProfile(true);
      const success = await updateUserProfile(profileName, profilePhone, profileDni);
      setSavingProfile(false);
      if (success) {
          setShowProfileModal(false);
      } else {
          alert("Error al guardar perfil. Intenta de nuevo.");
      }
  };
  const [mapCenter, setMapCenter] = useState({ lat: 9.05425221995597, lng: -62.05026626586915 });
  const [addressInput, setAddressInput] = useState({ pickup: '', destination: '' });
  const [selectedVehicle, setSelectedVehicle] = useState('sedan');
  const [isSearching, setIsSearching] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const [route, setRoute] = useState([]);

  // Función auxiliar para obtener ruta (igual que en Drive.jsx)
  const getRoute = async (startLat, startLng, endLat, endLng) => {
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
    } catch (error) {
        console.warn("Error al obtener ruta (OSRM puede estar sobrecargado):", error);
        // Retornar una línea recta como fallback en caso de error
        return [[startLat, startLng], [endLat, endLng]];
    }
    return null;
  };

  // Efecto para calcular la ruta (ya sea viaje activo o planificación)
  useEffect(() => {
    const calculateRoute = async () => {
        // ... (código previo para obtener coordenadas) ...
        let startLat, startLng, endLat, endLng;

        // Caso 0: Planificación (Sin viaje activo, pero con origen y destino seleccionados)
        if (!activeTrip && pickupLocation && destination) {
             startLat = pickupLocation.lat;
             startLng = pickupLocation.lng;
             endLat = destination.lat;
             endLng = destination.lng;
        }
        // Caso 1: Conductor aceptó y viene a recoger (Status: accepted, driver_arrived)
        else if (activeTrip && (activeTrip.status === 'accepted' || activeTrip.status === 'driver_arrived')) {
             startLat = activeTrip.driverLocation?.latitude || activeTrip.driverStartLocation?.lat;
             startLng = activeTrip.driverLocation?.longitude || activeTrip.driverStartLocation?.lng;
             endLat = activeTrip.location?.latitude;
             endLng = activeTrip.location?.longitude;
        } 
        // Caso 2: Viaje en curso hacia destino (Status: in_progress)
        else if (activeTrip && activeTrip.status === 'in_progress') {
             startLat = activeTrip.driverLocation?.latitude || activeTrip.location?.latitude; // Usar ubicación conductor o inicio
             startLng = activeTrip.driverLocation?.longitude || activeTrip.location?.longitude;
             endLat = activeTrip.destination?.latitude;
             endLng = activeTrip.destination?.longitude;
        }

        if (startLat && startLng && endLat && endLng) {
            const coords = await getRoute(startLat, startLng, endLat, endLng);
            // Validamos que el componente siga montado antes de setear estado (aunque React 18 lo maneja, es buena práctica si el fetch es lento)
            if (coords && coords.length > 0) {
                setRoute(coords);
            }
        } else {
            // Si falta algún punto o no aplica ninguno de los casos, limpiar ruta
            // PERO: Evitar limpiar si estamos en transición rápida o si solo falta un dato momentáneamente
            if (!activeTrip && (!pickupLocation || !destination)) {
                 setRoute([]);
            }
        }
    };

    calculateRoute();
  }, [activeTrip, activeTrip?.driverLocation, activeTrip?.status, pickupLocation, destination]);

  // Si el hook pide mostrar el selector (por validación fallida), iniciamos el flujo
  useEffect(() => {
    if (showDestinationSelector) {
        setShowInputs(true);
        setActiveField('pickup');
        setShowDestinationSelector(false);
    }
  }, [showDestinationSelector, setShowDestinationSelector]);

  // Inicializar mapa con ubicación de usuario
  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      
      // Si hay ubicación de usuario pero el pickupLocation no tiene dirección (carga inicial), obtenerla
      if (pickupLocation && !pickupLocation.address) {
          const fetchInitialAddress = async () => {
              try {
                  const { lat, lng } = userLocation;
                  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                  const data = await response.json();
                  const address = data.display_name || 'Ubicación actual';
                  
                  // Actualizar pickupLocation con la dirección para que aparezca en el input
                  setPickupLocation({ lat, lng, address });
              } catch (error) {
                  console.error("Error obteniendo dirección inicial:", error);
                  setPickupLocation({ ...userLocation, address: 'Ubicación actual' });
              }
          };
          fetchInitialAddress();
      }
    }
  }, [userLocation]);

  // Sincronizar inputs con ubicaciones seleccionadas
  useEffect(() => {
    if (pickupLocation?.address) {
      setAddressInput(prev => ({ ...prev, pickup: pickupLocation.address }));
    }
  }, [pickupLocation]);

  useEffect(() => {
    if (destination?.address) {
      setAddressInput(prev => ({ ...prev, destination: destination.address }));
    }
  }, [destination]);

  // Manejar click en el mapa
  const handleMapClick = async (latlng) => {
    if (!activeField) return;

    const { lat, lng } = latlng;
    
    // Geocodificación inversa
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      const address = data.display_name || 'Ubicación seleccionada';
      
      const locationData = { lat, lng, address };

      if (activeField === 'pickup') {
        setPickupLocation(locationData);
        setActiveField('destination'); // Pasar automáticamente al siguiente campo
      } else {
        setDestination(locationData);
        setActiveField(null); // Terminar selección
      }
    } catch (err) {
      console.error("Error al obtener dirección:", err);
    }
  };

  const handleInputChange = (field, value) => {
    setAddressInput(prev => ({ ...prev, [field]: value }));
  };

  // Buscar dirección por texto (al presionar Enter o botón buscar)
  const searchAddress = async (field) => {
    const query = addressInput[field];
    if (!query) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
        
        if (field === 'pickup') {
          setPickupLocation(newPos);
          setMapCenter(newPos);
          setActiveField('destination');
        } else {
          setDestination(newPos);
          setMapCenter(newPos);
          setActiveField(null);
        }
      } else {
        alert("Dirección no encontrada");
      }
    } catch (err) {
      console.error("Error buscando dirección:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetInputs = () => {
      setShowInputs(false);
      setDestination(null);
      setAddressInput(prev => ({ ...prev, destination: '' }));
      if (userLocation) {
          setPickupLocation(userLocation);
          // El useEffect se encargará de obtener la dirección si falta
      }
      setActiveField(null);
  };

  return (
    <div className="position-relative vh-100 overflow-hidden d-flex flex-column">
      
      {/* Alerta de GPS/Permisos */}
      {locationError && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <div className="card text-center p-4 m-3" style={{ maxWidth: '400px', borderRadius: '20px' }}>
                <div className="mb-3 text-warning">
                    <FaMapMarkerAlt size={50} />
                </div>
                <h4 className="fw-bold mb-3">Ubicación Requerida</h4>
                <p className="mb-4">{locationError}</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                    Reintentar
                </button>
            </div>
        </div>
      )}

      {/* Mapa de Fondo */}
      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ zIndex: 0 }}>
        <MapContainer 
          center={[mapCenter.lat, mapCenter.lng]} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <MapEvents activeField={!activeTrip ? activeField : null} onLocationSelect={handleMapClick} />
          <MapUpdater center={mapCenter} />

          {/* Marcadores de Selección */}
          {!activeTrip && pickupLocation && (
            <Marker position={[pickupLocation.lat, pickupLocation.lng]} />
          )}
          {!activeTrip && destination && (
             <Marker position={[destination.lat, destination.lng]} />
          )}
          
          {/* Línea entre puntos de selección 
          {!activeTrip && pickupLocation && destination && (
            <Polyline positions={[
              [pickupLocation.lat, pickupLocation.lng],
              [destination.lat, destination.lng]
            ]} color="blue" />
          )}*/}



          {/* Marcadores de Viaje Activo */}
          {activeTrip && activeTrip.location && (
             <Marker position={[activeTrip.location.latitude, activeTrip.location.longitude]} />
          )}
          {activeTrip && activeTrip.destination && (
             <Marker position={[activeTrip.destination.latitude, activeTrip.destination.longitude]} />
          )}
          {/* {activeTrip && activeTrip.location && activeTrip.destination && (
             <Polyline positions={[
               [activeTrip.location.latitude, activeTrip.location.longitude],
               [activeTrip.destination.latitude, activeTrip.destination.longitude]
             ]} color="red" />
          )} */}

          {/* Ruta calculada (Calles) */}
          <RoutePolyline route={route} />
          <RouteFitter route={route} />

          {/* Conductor en viaje activo */}
          <DriverMarker activeTrip={activeTrip} />
        </MapContainer>
      </div>

      {/* Contenido UI Overlay */}
      <div className="position-relative d-flex flex-column h-100 pointer-events-none" style={{ zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
            <Navbar user={user} />
        </div>

        <main className="container-fluid mt-auto d-flex flex-column align-items-center px-2 pointer-events-none">
          {/* Tarjeta Flotante Principal */}
          <div 
             className="card border-0 shadow-lg text-center p-4 w-100 pointer-events-auto" 
             style={{ 
               borderRadius: '30px 30px 0 0', 
               backgroundColor: 'rgba(255, 255, 255, 0.95)',
               maxWidth: '600px',
               pointerEvents: 'auto'
             }}
           >
             {!activeTrip ? (
                 <div className="animate__animated animate__fadeInUp">
                   
                   {!showInputs ? (
                      <div key="selection-mode" className="d-grid gap-3">
                          <h5 className="mb-2 fw-bold text-dark">¿A dónde quieres ir hoy?</h5>
                          <button 
                             className="btn btn-dark btn-lg py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 w-100 rounded-4"
                             onClick={() => {
                                 setShowInputs(true);
                                 if (pickupLocation) {
                                     setActiveField('destination');
                                 } else {
                                     setActiveField('pickup');
                                 }
                             }}
                          >
                              <FaSearch />
                              Seleccionar Destino
                          </button>
                      </div>
                   ) : (
                    <div key="input-mode">
                       {/* Ocultar encabezado e inputs si ya se seleccionaron ambos puntos */}
                       {(!pickupLocation || !destination) && (
                         <>
                           <div className="d-flex align-items-center justify-content-between mb-3">
                               <h5 className="mb-0 fw-bold text-dark">Planifica tu viaje</h5>
                               <button className="btn btn-sm btn-close" onClick={handleResetInputs}></button>
                           </div>

                           {/* Input Recogida */}
                           <div className={`input-group mb-3 ${activeField === 'pickup' ? 'border border-primary rounded-3' : ''}`}>
                             <span className="input-group-text bg-white border-end-0">
                               <FaMapMarkerAlt className="text-primary" />
                             </span>
                             <input 
                               type="text" 
                               className="form-control border-start-0" 
                               placeholder="Dirección de recogida"
                               value={addressInput.pickup}
                               onChange={(e) => handleInputChange('pickup', e.target.value)}
                               onFocus={() => setActiveField('pickup')}
                               onKeyDown={(e) => e.key === 'Enter' && searchAddress('pickup')}
                             />
                             {activeField === 'pickup' && (
                                 <button className="btn btn-outline-secondary border-start-0" onClick={() => searchAddress('pickup')}>
                                     <FaSearch />
                                 </button>
                             )}
                           </div>
        
                           {/* Input Destino */}
                           <div className={`input-group mb-4 ${activeField === 'destination' ? 'border border-danger rounded-3' : ''}`}>
                             <span className="input-group-text bg-white border-end-0">
                               <FaMapMarkedAlt className="text-danger" />
                             </span>
                             <input 
                               type="text" 
                               className="form-control border-start-0" 
                               placeholder="Dirección de destino"
                               value={addressInput.destination}
                               onChange={(e) => handleInputChange('destination', e.target.value)}
                               onFocus={() => setActiveField('destination')}
                               onKeyDown={(e) => e.key === 'Enter' && searchAddress('destination')}
                             />
                             {activeField === 'destination' && (
                                 <button className="btn btn-outline-secondary border-start-0" onClick={() => searchAddress('destination')}>
                                     <FaSearch />
                                 </button>
                             )}
                           </div>
                         </>
                       )}
    
                   {/* Selección de Vehículo y Confirmación */}
                   {pickupLocation && destination && (
                     <div className="animate__animated animate__fadeIn">
                       {/* Botón para volver atrás/cancelar selección */}
                       <div className="d-flex align-items-center justify-content-between mb-3">
                           <button className="btn btn-link text-decoration-none text-dark p-0 d-flex align-items-center gap-2" onClick={() => {
                               setDestination(null); // Limpiar destino para volver a mostrar inputs
                               setAddressInput(prev => ({ ...prev, destination: '' }));
                               setActiveField('destination');
                           }}>
                               <FaTimes /> Cambiar destino
                           </button>
                       </div>

                       <h6 className="fw-bold text-start mb-3 text-dark">Elige tu vehículo:</h6>
                       
                       <div className="d-flex flex-column gap-2 mb-4">
                         {/* Moto */}
                         <button 
                           className={`btn border w-100 p-3 rounded-4 d-flex align-items-center justify-content-between ${selectedVehicle === 'motorcycle' ? 'border-warning bg-warning bg-opacity-10' : 'border-light bg-light'}`}
                           onClick={() => setSelectedVehicle('motorcycle')}
                           style={{ transition: 'all 0.2s' }}
                         >
                           <div className="d-flex align-items-center gap-3">
                             <div className={`p-2 rounded-circle ${selectedVehicle === 'motorcycle' ? 'bg-white bg-opacity-50' : 'bg-white'}`}>
                                <FaMotorcycle size={20} className="text-dark" />
                             </div>
                             <div className="text-start">
                               <div className="fw-bold text-dark">Moto</div>
                               <small className="text-muted" style={{ fontSize: '0.75rem' }}>1 persona</small>
                             </div>
                           </div>
                           {selectedVehicle === 'motorcycle' && <FaCheckCircle className="text-dark" />}
                         </button>

                         {/* Sedan */}
                         <button 
                           className={`btn border w-100 p-3 rounded-4 d-flex align-items-center justify-content-between ${selectedVehicle === 'sedan' ? 'border-warning bg-warning bg-opacity-10' : 'border-light bg-light'}`}
                           onClick={() => setSelectedVehicle('sedan')}
                           style={{ transition: 'all 0.2s' }}
                         >
                           <div className="d-flex align-items-center gap-3">
                             <div className={`p-2 rounded-circle ${selectedVehicle === 'sedan' ? 'bg-white bg-opacity-50' : 'bg-white'}`}>
                                <FaCar size={20} className="text-dark" />
                             </div>
                             <div className="text-start">
                               <div className="fw-bold text-dark">Sedán</div>
                               <small className="text-muted" style={{ fontSize: '0.75rem' }}>Hasta 4 personas</small>
                             </div>
                           </div>
                           {selectedVehicle === 'sedan' && <FaCheckCircle className="text-dark" />}
                         </button>

                         {/* Camioneta */}
                         <button 
                           className={`btn border w-100 p-3 rounded-4 d-flex align-items-center justify-content-between ${selectedVehicle === 'truck' ? 'border-warning bg-warning bg-opacity-10' : 'border-light bg-light'}`}
                           onClick={() => setSelectedVehicle('truck')}
                           style={{ transition: 'all 0.2s' }}
                         >
                           <div className="d-flex align-items-center gap-3">
                             <div className={`p-2 rounded-circle ${selectedVehicle === 'truck' ? 'bg-white bg-opacity-50' : 'bg-white'}`}>
                                <FaTruck size={20} className="text-dark" />
                             </div>
                             <div className="text-start">
                               <div className="fw-bold text-dark">Camioneta</div>
                               <small className="text-muted" style={{ fontSize: '0.75rem' }}>Más espacio</small>
                             </div>
                           </div>
                           {selectedVehicle === 'truck' && <FaCheckCircle className="text-dark" />}
                         </button>
                       </div>

                       <div className="d-grid">
                         <button
                           className="btn btn-dark btn-lg py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 w-100"
                           onClick={() => handleRequestTaxi(selectedVehicle)}
                           disabled={loading || !selectedVehicle}
                           style={{ borderRadius: '15px' }}
                         >
                           {loading ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          ) : (
                            <FaTaxi />
                          )}
                           {loading ? 'Procesando...' : 'Confirmar y Pedir Viaje'}
                         </button>
                       </div>
                     </div>
                   )}
                       
                       {(!pickupLocation || !destination) && (
                           <p className="text-muted small mb-0 mt-2">
                             <small>Selecciona los puntos en el mapa o escribe la dirección.</small>
                           </p>
                       )}
                    </div>
                   )}
                 </div>
             ) : (
                // Vista de Viaje Activo (simplificada para encajar en el nuevo layout)
                <div className="animate__animated animate__fadeIn">
                    {/* ... (Lógica de viaje activo existente, adaptada si es necesario) ... */}
                    {/* Copiamos la lógica de renderizado de estado del viaje original */}
                    
                    {activeTrip.status === 'pending' ? (
                      <div className="text-center py-2">
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                          <FaClock className="text-warning spinner-grow spinner-grow-sm border-0" />
                          <span className="fw-bold">Esperando un conductor...</span>
                        </div>
                        
                        <button
                            className="btn btn-outline-danger w-100 py-2 fw-bold"
                            onClick={async () => {
                                await handleCancelTrip();
                                handleResetInputs();
                            }}
                        >
                            Cancelar
                        </button>
                      </div>
                    ) : activeTrip.status === 'offered' ? (
                        <div className="text-center">
                            <h5 className="fw-bold mb-3">¡Oferta Recibida!</h5>
                            <h2 className="display-4 fw-bold mb-3">${activeTrip.price}</h2>
                            <div className="d-flex align-items-center justify-content-center gap-3 mb-4">
                                {activeTrip.driverPhoto ? (
                                    <img src={activeTrip.driverPhoto} className="rounded-circle" width="50" height="50" />
                                ) : <FaUserCircle size={50} />}
                                <div className="text-start">
                                    <h6 className="mb-0">{activeTrip.driverName}</h6>
                                    <small className="text-muted">Conductor</small>
                                </div>
                            </div>
                            <div className="d-grid gap-2">
                                <button className="btn btn-dark py-3 rounded-pill" onClick={handleAcceptOffer}>Aceptar Oferta</button>
                                <button className="btn btn-outline-secondary py-2 rounded-pill" onClick={handleDeclineOffer}>Rechazar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-start">
                            <div className="alert alert-primary border-0 rounded-4 text-center py-3 mb-3 shadow-sm position-relative overflow-hidden">
                                <h5 className="fw-bold mb-1">
                                    {activeTrip.status === 'in_progress' ? 'En Viaje' : 'Conductor en camino'}
                                </h5>
                                <small className="d-block mb-2">{activeTrip.driverArrived ? '¡El conductor ha llegado!' : 'Tu conductor está cerca'}</small>
                                
                                <div className="bg-white bg-opacity-25 p-2 rounded-3 d-inline-block border border-primary border-opacity-25">
                                    <small className="text-primary-emphasis d-block text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Código de Viaje</small>
                                    <span className="fs-4 fw-black text-primary-emphasis tracking-tighter" style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
                                        {activeTrip.tripId}
                                    </span>
                                </div>
                            </div>

                            {/* Detalles del conductor simples */}
                            <div className="d-flex align-items-center justify-content-between mb-3 w-100 px-2">
                                <div className="d-flex align-items-center gap-3">
                                    <FaUserCircle size={40} className="text-secondary" />
                                    <div>
                                        <h6 className="mb-0">{activeTrip.driverName}</h6>
                                        <small className="text-muted d-block">{activeTrip.driverEmail}</small>
                                        {activeTrip.driverPhone && <small className="text-success fw-bold">{activeTrip.driverPhone}</small>}
                                    </div>
                                </div>
                                {activeTrip.driverPhone && (
                                    <a href={`tel:${activeTrip.driverPhone}`} className="btn btn-success rounded-circle shadow-sm p-3">
                                        <FaPhoneAlt size={20} />
                                    </a>
                                )}
                                {console.log(activeTrip)}
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        </main>
      </div>


      {/* Modal de Completar Perfil - Bloqueante */}
      {showProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="bg-white rounded-4 p-4 p-md-5 w-100 shadow-lg position-relative overflow-hidden" style={{ maxWidth: '450px' }}>
             
             <div className="text-center mb-4">
               <div className="bg-warning bg-opacity-25 rounded-circle p-3 d-inline-block mb-3">
                 <FaUserCircle className="text-warning display-4" size={50} />
               </div>
               <h3 className="fw-bold mb-2">¡Casi listo!</h3>
               <p className="text-muted small">Por favor confirma tus datos para continuar.</p>
             </div>

             <form onSubmit={handleSaveProfile}>
               <div className="mb-3">
                 <label className="form-label fw-bold small text-uppercase text-muted">Nombre</label>
                 <div className="input-group">
                   <span className="input-group-text bg-light border-end-0"><FaUserCircle className="text-secondary" /></span>
                   <input 
                     type="text" 
                     className="form-control bg-light border-start-0 py-3 shadow-none" 
                     placeholder="Tu nombre completo"
                     value={profileName}
                     onChange={(e) => setProfileName(e.target.value)}
                     required
                   />
                 </div>
               </div>

               <div className="mb-3">
                 <label className="form-label fw-bold small text-uppercase text-muted">Cédula de Identidad</label>
                 <div className="input-group">
                   <span className="input-group-text bg-light border-end-0"><FaIdCard className="text-secondary" /></span>
                   <input 
                     type="text" 
                     className="form-control bg-light border-start-0 py-3 shadow-none" 
                     placeholder="Tu Cédula"
                     value={profileDni}
                     onChange={(e) => setProfileDni(e.target.value)}
                     required
                   />
                 </div>
               </div>

               <div className="mb-4">
                 <label className="form-label fw-bold small text-uppercase text-muted">Teléfono</label>
                 <div className="input-group">
                   <span className="input-group-text bg-light border-end-0"><FaPhoneAlt className="text-secondary" /></span>
                   <input 
                     type="tel" 
                     className="form-control bg-light border-start-0 py-3 shadow-none" 
                     placeholder="Ej: 04141234567"
                     value={profilePhone}
                     onChange={(e) => setProfilePhone(e.target.value)}
                     required
                   />
                 </div>
                 <div className="form-text small">El conductor te llamará a este número.</div>
               </div>

               <button 
                 type="submit" 
                 className="btn btn-warning w-100 py-3 fw-bold shadow-sm rounded-3 d-flex align-items-center justify-content-center gap-2 text-dark"
                 disabled={savingProfile}
               >
                 {savingProfile ? (
                   <>
                     <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...
                   </>
                 ) : (
                   <>
                     Continuar <FaCar />
                   </>
                 )}
               </button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
