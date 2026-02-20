import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { FaUser, FaEye, FaSearch, FaTrash, FaEdit, FaEnvelope, FaPhone, FaIdCard, FaMoneyBillWave } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
const AdminUsers = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDebtors, setFilterDebtors] = useState(false);
  const [filterRole, setFilterRole] = useState('all'); // all, driver, passenger
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Settings (Commission Percentage)
        let pct = 0;
        try {
            const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
            if (settingsSnap.exists()) {
                pct = settingsSnap.data().servicePercentage || 0;
            }
        } catch (e) { 
            console.error("Error fetching settings:", e); 
        }
        setCommissionPercentage(pct);

        // 2. Fetch Users
        const usersRef = collection(db, 'users');
        let usersList = [];
        try {
          const q = query(usersRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          usersList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            debt: 0 // Initialize debt
          }));
        } catch (indexError) {
          console.warn("Index not found or sorting error, fetching unsorted:", indexError);
          const querySnapshot = await getDocs(usersRef);
          usersList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            debt: 0 // Initialize debt
          }));
        }

        // 3. Calculate Debt for Drivers (Parallel)
        const drivers = usersList.filter(u => u.hasVehicle);
        
        if (drivers.length > 0) {
            await Promise.all(drivers.map(async (driver) => {
                try {
                    // Fetch completed trips for this driver
                    const tripsQuery = query(
                        collection(db, 'taxiRequests'),
                        where('driverId', '==', driver.id),
                        where('status', '==', 'completed')
                    );
                    
                    const tripsSnapshot = await getDocs(tripsQuery);
                    let totalDebt = 0;

                    tripsSnapshot.docs.forEach(tripDoc => {
                        const trip = tripDoc.data();
                        const isPaid = trip.commissionStatus === 'paid' || trip.commissionPaid === true;
                        
                        if (!isPaid && trip.price) {
                             const tripPct = trip.servicePercentage !== undefined ? trip.servicePercentage : pct;
                             const fee = (trip.price * tripPct) / 100;
                             totalDebt += fee;
                        }
                    });
                    
                    driver.debt = totalDebt;
                } catch (err) {
                    console.error(`Error calculating debt for driver ${driver.id}:`, err);
                }
            }));
        }

        setUsers(usersList);

      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.dni && user.dni.includes(searchTerm)) ||
      (user.phone && user.phone.includes(searchTerm));

    let matchesFilter = true;
    if (filterDebtors) {
      matchesFilter = matchesFilter && user.debt > 0;
    }

    if (filterRole === 'driver') {
      matchesFilter = matchesFilter && user.hasVehicle === true;
    } else if (filterRole === 'passenger') {
      matchesFilter = matchesFilter && (!user.hasVehicle || user.hasVehicle === false);
    }

    return matchesSearch && matchesFilter;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
    return '-';
  };

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
          <h2 className="fw-bold m-0">Gestión de Usuarios</h2>
          <p className="text-muted m-0 small">Total de usuarios registrados: {users.length}</p>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <div className="btn-group shadow-sm">
            <button
              className={`btn ${filterRole === 'all' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setFilterRole('all')}
            >
              Todos
            </button>
            <button
              className={`btn ${filterRole === 'driver' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setFilterRole('driver')}
            >
              Conductores
            </button>
            <button
              className={`btn ${filterRole === 'passenger' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setFilterRole('passenger')}
            >
              Pasajeros
            </button>
          </div>

          <button
            className={`btn d-flex align-items-center gap-2 shadow-sm ${filterDebtors ? 'btn-danger text-white' : 'btn-outline-secondary'}`}
            onClick={() => setFilterDebtors(!filterDebtors)}
          >
            <FaMoneyBillWave />
            {filterDebtors ? 'Ver Todos' : 'Ver Deudores'}
          </button>
          <div className="input-group shadow-sm" style={{ maxWidth: '300px' }}>
            <span className="input-group-text bg-white border-end-0"><FaSearch className="text-muted" /></span>
            <input
              type="text"
              className="form-control border-start-0 ps-0"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light text-secondary small text-uppercase">
              <tr>
                <th className="border-0 py-3 ps-4">Usuario</th>
                <th className="border-0 py-3">Contacto</th>
                <th className="border-0 py-3">Documento</th>
                <th className="border-0 py-3 text-end">Deuda</th>
                <th className="border-0 py-3 text-end">Fecha Registro</th>
                <th className="border-0 py-3 text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="ps-4 py-3">
                      <div className="d-flex align-items-center">
                        <div className="position-relative me-3">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName}
                              className="rounded-circle border border-2 border-white shadow-sm"
                              width="40"
                              height="40"
                              style={{ objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="bg-light rounded-circle d-flex align-items-center justify-content-center border" style={{ width: '40px', height: '40px' }}>
                              <FaUser className="text-secondary" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{user.displayName || 'Sin Nombre'}</div>
                          <div className="small text-muted">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column small">
                        {user.phone ? (
                          <span className="text-dark mb-1"><FaPhone className="me-1 text-muted" size={10} /> {user.phone}</span>
                        ) : (
                          <span className="text-muted fst-italic">Sin teléfono</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {user.dni ? (
                        <span className="badge bg-light text-dark border fw-normal">
                          <FaIdCard className="me-1 text-secondary" />
                          {user.dni}
                        </span>
                      ) : (
                        <span className="text-muted small fst-italic">No registrado</span>
                      )}
                    </td>
                    <td className="text-end">
                      {user.debt > 0 ? (
                        <span className="badge bg-danger text-white fw-bold p-2">
                          ${user.debt.toFixed(2)}
                        </span>
                      ) : (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success fw-normal">
                          Al día
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      <span className="text-muted small">{formatDate(user.createdAt)}</span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-light text-secondary"
                          title="Ver Detalles"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/users/${user.id}`);
                          }}
                        >
                          <FaEye />
                        </button>
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
                      <FaUser className="display-4 mb-3 opacity-25" />
                      <p className="mb-0">No se encontraron usuarios que coincidan con la búsqueda.</p>
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

export default AdminUsers;
