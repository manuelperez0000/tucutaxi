import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { FaUser, FaPhone, FaEnvelope, FaIdCard, FaCar, FaHistory, FaArrowLeft, FaMoneyBillWave } from 'react-icons/fa';

const AdminUserDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debtStats, setDebtStats] = useState({
      totalDebt: 0,
      unpaidTrips: []
  });
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    totalSpent: 0, // For passengers
    totalEarned: 0 // For drivers
  });

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        // 1. Fetch User Profile
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          console.error("User not found");
          setLoading(false);
          return;
        }
        const userData = { id: userDoc.id, ...userDoc.data() };
        console.log("AdminUserDetails - User Data:", userData);
        setUser(userData);

        // 1.5 Fetch General Settings for Commission Percentage
        let commissionPercentage = 0;
        try {
            const settingsRef = doc(db, 'settings', 'general');
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                commissionPercentage = settingsSnap.data().servicePercentage || 0;
            }
        } catch (settingsError) {
            console.error("Error fetching settings:", settingsError);
        }

        // 1.6 If Driver, Calculate Debt (Fetch all completed unpaid trips)
        if (userData.hasVehicle) {
            try {
                // Fetch completed trips for this driver
                // Ideally we filter by commissionStatus != 'paid', but Firestore limitation
                // We'll fetch completed trips and filter in memory
                const debtQuery = query(
                    collection(db, 'taxiRequests'),
                    where('driverId', '==', userId),
                    where('status', '==', 'completed')
                );
                
                const debtSnapshot = await getDocs(debtQuery);
                let totalDebt = 0;
                const unpaidTripsList = [];

                debtSnapshot.docs.forEach(doc => {
                    const trip = { id: doc.id, ...doc.data() };
                    // Logic from myTrips.jsx: trip.commissionStatus === false (or undefined/null if treated as such)
                    // We assume commission is NOT paid if commissionStatus is not 'paid'
                    // And check if commissionPaid is explicitly false or undefined
                    
                    const isPaid = trip.commissionStatus === 'paid' || trip.commissionPaid === true;
                    
                    if (!isPaid && trip.price) {
                         const pct = trip.servicePercentage !== undefined ? trip.servicePercentage : commissionPercentage;
                         const fee = (trip.price * pct) / 100;
                         totalDebt += fee;
                         unpaidTripsList.push({ ...trip, commissionFee: fee });
                    }
                });

                // Sort unpaid trips by date descending
                unpaidTripsList.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return dateB - dateA;
                });

                setDebtStats({
                    totalDebt,
                    unpaidTrips: unpaidTripsList
                });

            } catch (debtError) {
                console.error("Error calculating debt:", debtError);
            }
        }

        // 2. Fetch Trips for table (limit 20)
        let tripsQuery;
        const tripsRef = collection(db, 'taxiRequests');
        
        // Define field to query based on role
        const queryField = userData.hasVehicle ? 'driverId' : 'userId';
        console.log("AdminUserDetails - Query Field:", queryField);

        try {
            tripsQuery = query(
                tripsRef, 
                where(queryField, '==', userId),
                orderBy('createdAt', 'desc'),
                limit(20)
            );
    
            const tripsSnapshot = await getDocs(tripsQuery);
            console.log("AdminUserDetails - Trips Snapshot Size:", tripsSnapshot.size);
            
            const tripsList = tripsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("AdminUserDetails - Trips List:", tripsList);
            setTrips(tripsList);
        } catch (queryError) {
            console.error("AdminUserDetails - Error querying trips (check indexes?):", queryError);
            // Fallback: Try without orderBy if index is missing
             tripsQuery = query(
                tripsRef, 
                where(queryField, '==', userId),
                limit(20)
            );
            const fallbackSnapshot = await getDocs(tripsQuery);
            console.log("AdminUserDetails - Fallback Snapshot Size:", fallbackSnapshot.size);

             const tripsList = fallbackSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => {
                // Client-side sort for fallback data
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
             
             console.log("AdminUserDetails - Fallback Trips List:", tripsList);
             setTrips(tripsList);
        }

        // 3. Calculate Stats (Total counts)
        // To get accurate counts without downloading all documents, we use count queries
        
        // Total Trips
        const totalQuery = query(tripsRef, where(queryField, '==', userId));
        const totalSnapshot = await getCountFromServer(totalQuery);
        const totalCount = totalSnapshot.data().count;

        // Completed Trips
        const completedQuery = query(tripsRef, where(queryField, '==', userId), where('status', '==', 'completed'));
        const completedSnapshot = await getCountFromServer(completedQuery);
        const completedCount = completedSnapshot.data().count;

        // Cancelled Trips
        const cancelledQuery = query(tripsRef, where(queryField, '==', userId), where('status', '==', 'cancelled'));
        const cancelledSnapshot = await getCountFromServer(cancelledQuery);
        const cancelledCount = cancelledSnapshot.data().count;
        
        setStats({
            totalTrips: totalCount,
            completedTrips: completedCount,
            cancelledTrips: cancelledCount
        });

      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserDetails();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-5">
        <h3>Usuario no encontrado</h3>
        <button className="btn btn-primary mt-3" onClick={() => navigate('/admin/users')}>
            Volver a Usuarios
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      <button 
        className="btn btn-link text-decoration-none ps-0 mb-3 d-flex align-items-center text-secondary"
        onClick={() => navigate('/admin/users')}
      >
        <FaArrowLeft className="me-2" /> Volver a Lista de Usuarios
      </button>

      <div className="row g-4">
        {/* User Profile Card */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body text-center p-4">
              <div className="mb-3 position-relative d-inline-block">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName} 
                    className="rounded-circle border border-4 border-light shadow-sm" 
                    width="120" 
                    height="120" 
                    style={{ objectFit: 'cover' }} 
                  />
                ) : (
                  <div className="bg-light rounded-circle d-flex align-items-center justify-content-center mx-auto border" style={{ width: '120px', height: '120px' }}>
                    <FaUser className="text-secondary display-4" />
                  </div>
                )}
                {user.hasVehicle && (
                    <span className="position-absolute bottom-0 end-0 badge rounded-pill bg-primary border border-2 border-white p-2" title="Conductor">
                        <FaCar />
                    </span>
                )}
              </div>
              
              <h4 className="fw-bold mb-1">{user.displayName || 'Sin Nombre'}</h4>
              <p className="text-muted mb-3">{user.email}</p>
              
              <div className="d-flex justify-content-center gap-2 mb-4">
                {user.hasVehicle ? (
                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary">Conductor</span>
                ) : (
                    <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary">Pasajero</span>
                )}
                <span className="badge bg-light text-dark border">
                    Registro: {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                </span>
              </div>

              <hr className="my-4" />

              <div className="text-start">
                <h6 className="text-uppercase text-muted small fw-bold mb-3">Información de Contacto</h6>
                
                <div className="d-flex align-items-center mb-3">
                    <div className="bg-light rounded-circle p-2 me-3 text-secondary">
                        <FaPhone />
                    </div>
                    <div>
                        <div className="small text-muted">Teléfono</div>
                        <div className="fw-medium">{user.phone || 'No registrado'}</div>
                    </div>
                </div>

                <div className="d-flex align-items-center mb-3">
                    <div className="bg-light rounded-circle p-2 me-3 text-secondary">
                        <FaEnvelope />
                    </div>
                    <div>
                        <div className="small text-muted">Email</div>
                        <div className="fw-medium">{user.email || 'No registrado'}</div>
                    </div>
                </div>

                <div className="d-flex align-items-center">
                    <div className="bg-light rounded-circle p-2 me-3 text-secondary">
                        <FaIdCard />
                    </div>
                    <div>
                        <div className="small text-muted">DNI / Documento</div>
                        <div className="fw-medium">{user.dni || 'No registrado'}</div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats and Trips */}
        <div className="col-12 col-lg-8">
            {/* Quick Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm rounded-4 bg-primary text-white h-100">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="display-5 fw-bold mb-1">{stats.totalTrips}</div>
                                    <div className="small opacity-75">Viajes Totales</div>
                                </div>
                                <FaHistory className="opacity-50 fs-3" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="display-5 fw-bold mb-1 text-success">{stats.completedTrips}</div>
                                    <div className="small text-muted">Completados</div>
                                </div>
                                <div className="bg-success bg-opacity-10 p-2 rounded-circle text-success">
                                    <FaCar />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="display-5 fw-bold mb-1 text-danger">{stats.cancelledTrips}</div>
                                    <div className="small text-muted">Cancelados</div>
                                </div>
                                <div className="bg-danger bg-opacity-10 p-2 rounded-circle text-danger">
                                    <FaHistory />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trips History */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="card-header bg-white py-3 px-4 border-0">
                    <h5 className="mb-0 fw-bold">Historial de Viajes Recientes</h5>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light text-secondary small text-uppercase">
                            <tr>
                                <th className="ps-4 py-3 border-0">Fecha</th>
                                <th className="py-3 border-0">Origen / Destino</th>
                                <th className="py-3 border-0">Estado</th>
                                <th className="text-end pe-4 py-3 border-0">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.length > 0 ? (
                                trips.map(trip => (
                                    <tr key={trip.id}>
                                        <td className="ps-4 py-3">
                                            <div className="fw-medium text-dark">
                                                {trip.createdAt?.toDate ? trip.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                            </div>
                                            <div className="small text-muted">
                                                {trip.createdAt?.toDate ? trip.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                            </div>
                                        </td>
                                        <td className="py-3" style={{ minWidth: '200px' }}>
                                            <div className="d-flex flex-column small">
                                                <div className="mb-1 text-truncate" style={{ maxWidth: '250px' }}>
                                                    <span className="text-success me-1">●</span> {trip.pickup?.address || 'Origen desconocido'}
                                                </div>
                                                <div className="text-truncate" style={{ maxWidth: '250px' }}>
                                                    <span className="text-danger me-1">●</span> {trip.destination?.address || 'Destino desconocido'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <span className={`badge rounded-pill ${
                                                trip.status === 'completed' ? 'bg-success' : 
                                                trip.status === 'cancelled' ? 'bg-danger' : 
                                                'bg-warning text-dark'
                                            }`}>
                                                {trip.status === 'completed' ? 'Completado' : 
                                                 trip.status === 'cancelled' ? 'Cancelado' : 
                                                 trip.status}
                                            </span>
                                        </td>
                                        <td className="text-end pe-4 py-3 fw-bold">
                                            ${trip.price?.toFixed(2) || '0.00'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="text-center py-5 text-muted">
                                        No hay viajes registrados recientemente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Unpaid Trips Section (Only for Drivers) */}
            {user.hasVehicle && (
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden mt-4">
                    <div className="card-header bg-danger bg-opacity-10 py-3 px-4 border-0 d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="mb-0 fw-bold text-danger">Deuda Pendiente: ${debtStats.totalDebt.toFixed(2)}</h5>
                            <small className="text-muted">Viajes completados sin comisión pagada</small>
                        </div>
                        <span className="badge bg-danger rounded-pill px-3 py-2">
                            {debtStats.unpaidTrips.length} Viajes
                        </span>
                    </div>
                    {debtStats.unpaidTrips.length > 0 && (
                        <div className="table-responsive" style={{ maxHeight: '400px' }}>
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light text-secondary small text-uppercase sticky-top">
                                    <tr>
                                        <th className="ps-4 py-3 border-0">Fecha</th>
                                        <th className="py-3 border-0">Referencia Viaje</th>
                                        <th className="text-end py-3 border-0">Monto Viaje</th>
                                        <th className="text-end pe-4 py-3 border-0">Comisión</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {debtStats.unpaidTrips.map(trip => (
                                        <tr key={trip.id}>
                                            <td className="ps-4 py-3">
                                                <div className="fw-medium text-dark">
                                                    {trip.createdAt?.toDate ? trip.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className="font-monospace small text-muted">
                                                    {trip.id.substring(0, 8)}...
                                                </span>
                                            </td>
                                            <td className="text-end py-3 text-muted">
                                                ${trip.price?.toFixed(2)}
                                            </td>
                                            <td className="text-end pe-4 py-3 fw-bold text-danger">
                                                ${trip.commissionFee?.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default AdminUserDetails;
