import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { FaCar, FaMotorcycle, FaSearch, FaClock, FaTrash, FaEdit, FaUser, FaPhone, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const AdminVehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchVehiclesAndOwners = async () => {
      try {
        const vehiclesRef = collection(db, 'vehicles');
        const vehicleSnapshot = await getDocs(vehiclesRef);
        
        const vehiclesData = await Promise.all(vehicleSnapshot.docs.map(async (vehicleDoc) => {
          const vehicleData = vehicleDoc.data();
          const userId = vehicleDoc.id; // Document ID is the User ID
          
          let ownerData = { displayName: 'Desconocido', phone: 'No registrado', email: '' };
          
          try {
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              ownerData = {
                displayName: userData.displayName || userData.name || 'Sin Nombre',
                phone: userData.phone || 'Sin Teléfono',
                email: userData.email || ''
              };
            }
          } catch (error) {
            console.error(`Error fetching owner for vehicle ${vehicleDoc.id}:`, error);
          }

          return {
            id: vehicleDoc.id,
            ...vehicleData,
            owner: ownerData
          };
        }));

        setVehicles(vehiclesData);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehiclesAndOwners();
  }, []);

  const filteredVehicles = vehicles.filter(vehicle => 
    (vehicle.brand && vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (vehicle.model && vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (vehicle.owner.displayName && vehicle.owner.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (vehicle.owner.phone && vehicle.owner.phone.includes(searchTerm))
  );

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border text-warning display-4" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h2 className="fw-bold m-0">Gestión de Vehículos</h2>
          <p className="text-muted m-0 small">Total de vehículos registrados: {vehicles.length}</p>
        </div>
        
        <div className="input-group shadow-sm" style={{ maxWidth: '300px' }}>
          <span className="input-group-text bg-white border-end-0"><FaSearch className="text-muted" /></span>
          <input 
            type="text" 
            className="form-control border-start-0 ps-0" 
            placeholder="Buscar por marca, modelo, dueño..." 
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
                <th className="border-0 py-3 ps-4">Vehículo</th>
                <th className="border-0 py-3">Detalles</th>
                <th className="border-0 py-3">Propietario</th>
                <th className="border-0 py-3">Estado</th>
                <th className="border-0 py-3 text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td className="ps-4 py-3">
                      <div className="d-flex align-items-center">
                        <div className="bg-light rounded-circle p-2 me-3 text-secondary border">
                          {vehicle.type === 'motorcycle' ? <FaMotorcycle size={20} /> : vehicle.type === 'truck' ? <FaTruck size={20} /> : <FaCar size={20} />}
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{vehicle.brand} {vehicle.model}</div>
                          <div className="small text-muted">{vehicle.year}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small text-muted">
                        <div className="mb-1">Asientos: <span className="fw-bold text-dark">{vehicle.seats}</span></div>
                        <div>A/C: <span className={`fw-bold ${vehicle.ac ? 'text-success' : 'text-danger'}`}>{vehicle.ac ? 'Sí' : 'No'}</span></div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column small">
                        <span className="fw-bold text-dark mb-1">
                          <FaUser className="me-1 text-muted" size={10} /> 
                          {vehicle.owner.displayName}
                        </span>
                        <span className="text-muted">
                          <FaPhone className="me-1 text-muted" size={10} /> 
                          {vehicle.owner.phone}
                        </span>
                      </div>
                    </td>
                    <td>
                      {vehicle.approved ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-2">
                          <FaCheckCircle className="me-1" /> Aprobado
                        </span>
                      ) : (
                        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 rounded-pill px-3 py-2">
                          <FaClock className="me-1" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group">
                        <button className="btn btn-sm btn-light text-primary" title="Editar">
                          <FaEdit />
                        </button>
                        <button className="btn btn-sm btn-light text-danger" title="Eliminar">
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
                      <FaCar className="display-4 mb-3 opacity-25" />
                      <p className="mb-0">No se encontraron vehículos que coincidan con la búsqueda.</p>
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

export default AdminVehicles;
