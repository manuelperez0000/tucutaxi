import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { FaRoute, FaSearch, FaSpinner, FaMapMarkerAlt, FaUser, FaCar, FaCalendarAlt, FaMoneyBillWave, FaArrowRight, FaTrash } from 'react-icons/fa';

const AdminTrips = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const tripsRef = collection(db, 'taxiRequests');
        // Filtramos por estado 'completed'
        // Nota: Si no hay índice compuesto, esto podría fallar con orderBy. 
        // Para evitar errores de índice en desarrollo, primero obtenemos y luego ordenamos en cliente si es necesario,
        // o usamos solo where si la colección es pequeña.
        // Intentaremos traer todos los 'completed'
        const q = query(tripsRef, where('status', '==', 'completed'));
        
        const querySnapshot = await getDocs(q);
        
        const tripsData = await Promise.all(querySnapshot.docs.map(async (tripDoc) => {
          const tripData = tripDoc.data();
          
          let passengerName = 'Desconocido';
          let driverName = 'Desconocido';

          // Obtener datos del pasajero
          if (tripData.userId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', tripData.userId));
              if (userDoc.exists()) {
                passengerName = userDoc.data().displayName || userDoc.data().name || 'Sin Nombre';
              }
            } catch (e) { console.error("Error fetching passenger", e); }
          }

          // Obtener datos del conductor
          if (tripData.driverId) {
            try {
              const driverDoc = await getDoc(doc(db, 'users', tripData.driverId));
              if (driverDoc.exists()) {
                driverName = driverDoc.data().displayName || driverDoc.data().name || 'Sin Nombre';
              }
            } catch (e) { console.error("Error fetching driver", e); }
          }

          return {
            id: tripDoc.id,
            ...tripData,
            passengerName,
            driverName
          };
        }));

        // Ordenar por fecha (más reciente primero) en el cliente
        tripsData.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        setTrips(tripsData);
      } catch (error) {
        console.error("Error fetching trips:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, []);

  const handleDeleteTrip = async (tripId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este viaje? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'taxiRequests', tripId));
        setTrips(trips.filter(trip => trip.id !== tripId));
      } catch (error) {
        console.error("Error al eliminar el viaje:", error);
        alert('Error al eliminar el viaje. Por favor intenta de nuevo.');
      }
    }
  };

  const filteredTrips = trips.filter(trip => 
    (trip.address && trip.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (trip.destination?.address && trip.destination.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (trip.passengerName && trip.passengerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (trip.driverName && trip.driverName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    if (timestamp.toDate) return timestamp.toDate().toLocaleString();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleString();
    return '-';
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border text-warning" style={{ width: '3rem', height: '3rem' }} role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h2 className="fw-bold m-0">Historial de Viajes</h2>
          <p className="text-muted m-0 small">Total de viajes completados: {trips.length}</p>
        </div>
        
        <div className="input-group shadow-sm" style={{ maxWidth: '300px' }}>
          <span className="input-group-text bg-white border-end-0"><FaSearch className="text-muted" /></span>
          <input 
            type="text" 
            className="form-control border-start-0 ps-0" 
            placeholder="Buscar ubicación, conductor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light text-secondary small text-uppercase">
              <tr>
                <th className="border-0 py-3 ps-4">Ruta</th>
                <th className="border-0 py-3">Involucrados</th>
                <th className="border-0 py-3">Precio</th>
                <th className="border-0 py-3">Fecha</th>
                <th className="border-0 py-3 text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.length > 0 ? (
                filteredTrips.map(trip => (
                  <tr key={trip.id}>
                    <td className="ps-4 py-3" style={{ minWidth: '250px' }}>
                      <div className="d-flex flex-column gap-2">
                        <div className="d-flex align-items-start gap-2">
                          <FaMapMarkerAlt className="text-success mt-1 flex-shrink-0" size={12} />
                          <small className="text-muted lh-sm">{trip.address || 'Origen desconocido'}</small>
                        </div>
                        <div className="d-flex align-items-start gap-2">
                          <FaArrowRight className="text-secondary mt-1 flex-shrink-0" size={10} style={{ transform: 'rotate(90deg)' }} />
                        </div>
                        <div className="d-flex align-items-start gap-2">
                          <FaMapMarkerAlt className="text-danger mt-1 flex-shrink-0" size={12} />
                          <small className="text-dark fw-medium lh-sm">{trip.destination?.address || 'Destino desconocido'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex align-items-center gap-2 small">
                          <FaUser className="text-muted" />
                          <span className="text-dark fw-medium">{trip.passengerName}</span>
                          <span className="badge bg-light text-secondary border rounded-pill" style={{ fontSize: '0.65rem' }}>Pasajero</span>
                        </div>
                        <div className="d-flex align-items-center gap-2 small">
                          <FaCar className="text-muted" />
                          <span className="text-dark fw-medium">{trip.driverName}</span>
                          <span className="badge bg-warning bg-opacity-25 text-warning-emphasis border border-warning border-opacity-25 rounded-pill" style={{ fontSize: '0.65rem' }}>Conductor</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <FaMoneyBillWave className="text-success" />
                        <span className="fw-bold fs-5">${trip.price}</span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2 text-muted small">
                        <FaCalendarAlt />
                        {formatDate(trip.createdAt)}
                      </div>
                    </td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end align-items-center gap-2">
                        <span className="badge bg-success text-white rounded-pill px-3 py-2">
                          Completado
                        </span>
                        <button 
                          className="btn btn-outline-danger btn-sm border-0"
                          onClick={() => handleDeleteTrip(trip.id)}
                          title="Eliminar viaje"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-5">
                    <div className="d-flex flex-column align-items-center text-muted">
                      <FaRoute className="display-4 mb-3 opacity-25" />
                      <p className="mb-0">No se encontraron viajes completados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminTrips;
