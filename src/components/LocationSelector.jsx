import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt, FaSearch } from 'react-icons/fa';

// Fix for default marker icon
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const LocationMarker = ({ position, setPosition, setAddress }) => {
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition({ lat, lng });
      reverseGeocode(lat, lng, setAddress);
    },
  });

  return position ? (
    <Marker position={[position.lat, position.lng]} />
  ) : null;
};

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.centerLng || center.lng], map.getZoom());
    }
  }, [center, map]);
  return null;
};

const reverseGeocode = async (lat, lng, setAddress) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await response.json();
    setAddress(data.display_name || 'Ubicación seleccionada');
  } catch (err) {
    console.error("Error al obtener dirección:", err);
  }
};

const LocationSelector = ({ 
    onLocationSelected, 
    initialLocation, 
    title = "Seleccionar Ubicación",
    placeholder = "Buscar dirección...",
    confirmText = "Confirmar Ubicación",
    confirmButtonColor = "btn-dark",
    iconColorClass = "text-danger"
}) => {
  const [selectedPos, setSelectedPos] = useState(initialLocation ? { lat: initialLocation.lat, lng: initialLocation.lng } : null);
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Default center: Tucuman or initialLocation
  const [mapCenter, setMapCenter] = useState(initialLocation ? { lat: initialLocation.lat, lng: initialLocation.lng } : { lat: -26.829, lng: -65.217 });

  useEffect(() => {
      // If initialLocation changes (e.g. GPS found), update the map
      if (initialLocation) {
          const newPos = { lat: initialLocation.lat, lng: initialLocation.lng };
          setSelectedPos(newPos);
          setMapCenter(newPos);
          if (initialLocation.address) {
              setAddress(initialLocation.address);
          } else {
              // Try to reverse geocode if address is missing but we have coords
              reverseGeocode(newPos.lat, newPos.lng, setAddress);
          }
      }
  }, [initialLocation]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;

    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setSelectedPos(newPos);
        setAddress(display_name);
        setMapCenter(newPos);
      } else {
        alert("No se encontró la ubicación");
      }
    } catch (err) {
      console.error("Error al buscar ubicación:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    if (selectedPos) {
      onLocationSelected({
        lat: selectedPos.lat,
        lng: selectedPos.lng,
        address: address || 'Ubicación seleccionada'
      });
    }
  };

  return (
    <div className="destination-selector mt-2">
      <h6 className="fw-bold mb-2 px-1">{title}</h6>
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="card-body p-0">
          <div className="p-3 bg-white border-bottom">
            <form onSubmit={handleSearch} className="input-group mb-2">
              <input
                type="text"
                className="form-control border-end-0 rounded-start-pill ps-4"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ height: '50px' }}
              />
              <button 
                type="submit" 
                className="btn btn-warning rounded-end-pill px-4"
                disabled={searching}
              >
                {searching ? <div className="spinner-border spinner-border-sm" /> : <FaSearch />}
              </button>
            </form>
            {address && (
              <div className="d-flex align-items-center gap-2 px-2 py-1">
                <FaMapMarkerAlt className={`${iconColorClass} flex-shrink-0`} />
                <small className="text-muted text-truncate">{address}</small>
              </div>
            )}
          </div>

          <div style={{ height: '300px', width: '100%' }}>
            <MapContainer 
              center={[mapCenter.lat, mapCenter.lng]} 
              zoom={15} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <LocationMarker 
                position={selectedPos} 
                setPosition={setSelectedPos} 
                setAddress={setAddress} 
              />
              <MapUpdater center={mapCenter} />
            </MapContainer>
          </div>

          <div className="p-3 bg-light">
            <button
              className={`btn ${confirmButtonColor} w-100 py-3 fw-bold rounded-pill`}
              onClick={handleConfirm}
              disabled={!selectedPos}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;