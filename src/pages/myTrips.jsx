import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { FaUser, FaCar, FaClock, FaMoneyBillWave, FaMapMarkerAlt, FaHistory, FaPercentage, FaFilter, FaCalendarAlt, FaTimes, FaCheckCircle, FaExclamationCircle, FaUniversity, FaMobileAlt, FaCopy, FaArrowRight } from 'react-icons/fa';

import { useNavigate } from 'react-router-dom';

const MyTrips = ({ user }) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('passenger'); // 'passenger' | 'driver'
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  const navigate = useNavigate();

  // Estados para filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Datos de pago de prueba
  const paymentData = {
    bank: {
      bankName: "Banco de Venezuela",
      accountNumber: "0102-0123-45-0000123456",
      accountHolder: "Administrador Giro",
      idNumber: "V-12.345.678"
    },
    mobilePayment: {
      bankCode: "0102",
      phoneNumber: "0414-1234567",
      idNumber: "12.345.678"
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copiado al portapapeles: " + text);
  };

  useEffect(() => {
    const fetchTripsAndConfig = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // 0. Verificar si el usuario es conductor (tiene vehículo registrado)
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        let isDriver = false;
        if (userSnap.exists() && userSnap.data().hasVehicle) {
            isDriver = true;
            setUserRole('driver');
        } else {
            setUserRole('passenger');
        }

        // 1. Obtener porcentaje de comisión global
        const settingsRef = doc(db, 'settings', 'general');
        const settingsSnap = await getDoc(settingsRef);
        let currentCommission = 0;
        if (settingsSnap.exists()) {
          currentCommission = settingsSnap.data().servicePercentage || 0;
          setCommissionPercentage(currentCommission);
        }

        // 2. Determinar si el usuario es conductor (para mostrar vistas diferentes si se desea, 
        // aunque aquí cargaremos todos los viajes donde participa)
        // Buscaremos viajes donde el usuario sea pasajero (userId) O conductor (driverId)

        // Firestore no permite consultas OR directas eficientes para campos diferentes en una sola query compleja con orderBy
        // Así que haremos dos consultas y combinaremos

        // Consulta como Pasajero
        const passengerQuery = query(
          collection(db, 'taxiRequests'),
          where('userId', '==', user.uid)
        );

        // Consulta como Conductor
        const driverQuery = query(
          collection(db, 'taxiRequests'),
          where('driverId', '==', user.uid)
        );

        const [passengerSnapshot, driverSnapshot] = await Promise.all([
          getDocs(passengerQuery),
          getDocs(driverQuery)
        ]);

        const passengerTrips = passengerSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          role: 'passenger'
        }));

        const driverTrips = driverSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          role: 'driver'
        }));

        // Combinar y ordenar por fecha
        const allTrips = [...passengerTrips, ...driverTrips].sort((a, b) => {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA;
        });

        setTrips(allTrips);

      } catch (error) {
        console.error("Error al cargar viajes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTripsAndConfig();
  }, [user]);

  // Efecto para filtrar viajes y calcular ganancias
  useEffect(() => {
    // Filtrar viajes cancelados antes de aplicar otros filtros
    let filtered = trips.filter(trip => trip.status !== 'cancelled');
    
    // Lista completa para deuda (sin filtrar por fecha para mostrar deuda total real)
    let allCompletedDriverTrips = trips.filter(trip => trip.role === 'driver' && trip.status === 'completed');

    // 1. Filtrar por fecha para mostrar en lista y calcular ganancias del periodo
    if (startDate && endDate) {
      // Crear fechas usando componentes locales para evitar problemas de zona horaria UTC
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

      filtered = filtered.filter(trip => {
        const tripDate = trip.createdAt?.toDate() || new Date(0);
        return tripDate >= start && tripDate <= end;
      });
    } else {
      // Si no hay filtro de fecha, limitar a los últimos 20
      filtered = filtered.slice(0, 20);
    }

    setFilteredTrips(filtered);

    // 2. Calcular ganancias totales del periodo filtrado
    let earnings = 0;
    filtered.forEach(trip => {
      if (trip.role === 'driver' && trip.status === 'completed' && trip.price) {
        const pct = trip.servicePercentage !== undefined ? trip.servicePercentage : commissionPercentage;
        const fee = (trip.price * pct) / 100;
        const net = trip.price - fee;
        earnings += net;
      }
    });
    setTotalEarnings(earnings);

    // 3. Calcular Deuda Total (de TODOS los viajes, no solo los filtrados)
    let debt = 0;
    allCompletedDriverTrips.forEach(trip => {
        if (trip.commissionStatus === false && trip.price) {
            const pct = trip.servicePercentage !== undefined ? trip.servicePercentage : commissionPercentage;
            const fee = (trip.price * pct) / 100;
            debt += fee;
        }
    });
    setTotalDebt(debt);

  }, [trips, startDate, endDate, commissionPercentage]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Fecha desconocida';
    return timestamp.toDate().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateEarnings = (price) => {
    if (!price) return { net: 0, fee: 0 };
    const fee = (price * commissionPercentage) / 100;
    const net = price - fee;
    return { net, fee };
  };

  return (
    <div className="vh-100 d-flex flex-column bg-light overflow-hidden">
      <div className="flex-shrink-0">
        <Navbar user={user} />
      </div>

      <div className="flex-grow-1 overflow-auto p-3 p-md-4">
        <div className="container" style={{ maxWidth: '800px' }}>

          <div className="d-flex align-items-center justify-content-between mb-4">
            <h2 className="fw-bold mb-0">Mis Viajes</h2>
            {userRole === 'driver' && (
                <button 
                    className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 py-2 shadow-sm fw-bold"
                    onClick={() => navigate('/billing')}
                >
                    <FaMoneyBillWave /> Facturación
                </button>
            )}
          </div>

          {/* Resumen de Ganancias y Deuda (Solo si es conductor) */}
          {userRole === 'driver' && (
            <div className="row g-3 mb-4">
                {/* Ganancias */}
                <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm rounded-4 mb-0 bg-success text-white overflow-hidden h-100">
                        <div className="card-body p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-1 opacity-75">Ganancias Totales</h6>
                                <small className="opacity-50">En el periodo seleccionado</small>
                            </div>
                            <div className="text-end">
                                <h2 className="fw-bold mb-0">${totalEarnings.toFixed(2)}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Deuda Pendiente */}
                <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm rounded-4 mb-0 bg-danger text-white overflow-hidden h-100">
                        <div className="card-body p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-1 opacity-75">Deuda Pendiente</h6>
                                <small className="opacity-50">Comisiones por pagar</small>
                            </div>
                            <div className="text-end">
                                <h2 className="fw-bold mb-0">${totalDebt.toFixed(2)}</h2>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* Filtros de Fecha */}
          <div className="card border-0 shadow-sm rounded-4 mb-0 overflow-hidden">
            <div className="card-body p-4">

              <div className="row g-3 align-items-end">
                <div className="col-6 col-md-4">
                  <label className="form-label small text-muted fw-bold">Desde</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0"><FaCalendarAlt className="text-muted" /></span>
                    <input
                      type="date"
                      className="form-control bg-light border-0"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small text-muted fw-bold">Hasta</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0"><FaCalendarAlt className="text-muted" /></span>
                    <input
                      type="date"
                      className="form-control bg-light border-0"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  {startDate && endDate && (
                    <button
                      className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                    >
                      <FaTimes /> Limpiar Filtro
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary fs-1" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3 text-muted">Cargando historial...</p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-4 shadow-sm">
              <div className="bg-light rounded-circle p-4 d-inline-block mb-3">
                <FaCar className="text-secondary display-4 opacity-50" />
              </div>
              <h4 className="fw-bold text-dark">No se encontraron viajes</h4>
              <p className="text-muted">Intenta ajustar los filtros de fecha.</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {filteredTrips.map(trip => {
                const isDriver = trip.role === 'driver';
                const { net, fee } = isDriver && trip.price ? calculateEarnings(trip.price) : { net: 0, fee: 0 };

                return (
                  <div key={trip.id} className="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div className={`card-header border-0 py-3 px-4 d-flex justify-content-between align-items-center ${isDriver ? 'bg-dark text-white' : 'bg-white'}`}>
                      <div className="d-flex align-items-center gap-2">
                        {isDriver ? <FaCar className="text-warning" /> : <FaUser className="text-primary" />}
                        <span className="fw-bold small text-uppercase letter-spacing-1">
                          {isDriver ? 'Conductor' : 'Pasajero'}
                        </span>
                      </div>
                      <span className={`badge rounded-pill px-3 py-2 ${trip.status === 'completed' ? 'bg-success' :
                          trip.status === 'cancelled' ? 'bg-danger' :
                            'bg-warning text-dark'
                        }`}>
                        {trip.status === 'completed' ? 'Completado' :
                          trip.status === 'cancelled' ? 'Cancelado' :
                            trip.status === 'in_progress' ? 'En Curso' : trip.status}
                      </span>
                    </div>

                    <div className="card-body p-4">
                      <div className="row g-3">
                        <div className="col-12 col-md-8">
                          <div className="d-flex flex-column gap-3">
                            <div>
                              <small className="text-muted d-flex align-items-center gap-1 mb-1">
                                <FaMapMarkerAlt className="text-success" /> Origen
                              </small>
                              <p className="mb-0 fw-medium text-dark">{trip.address || 'Ubicación de recogida'}</p>
                            </div>
                            <div className="border-start border-2 border-light ps-3 ms-2"></div>
                            <div>
                              <small className="text-muted d-flex align-items-center gap-1 mb-1">
                                <FaMapMarkerAlt className="text-danger" /> Destino
                              </small>
                              <p className="mb-0 fw-medium text-dark">{trip.destination?.address || 'Destino seleccionado'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="col-12 col-md-4 border-start-md">
                          <div className="h-100 d-flex flex-column justify-content-between gap-3">
                            <div>
                              <small className="text-muted d-flex align-items-center gap-1">
                                <FaClock /> Fecha
                              </small>
                              <p className="mb-0 fw-bold">{formatDate(trip.createdAt)}</p>
                            </div>

                            {trip.price && (
                              <div className="bg-light p-3 rounded-3">
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                  <span className="text-muted small">Precio Total</span>
                                  <span className="fw-bold text-dark fs-5">${trip.price}</span>
                                </div>

                                {isDriver && (
                                  <>
                                    <div className="border-top my-2"></div>
                                    <div className="d-flex align-items-center justify-content-between text-danger small mb-1">
                                      <span><FaPercentage size={10} /> Comisión ({commissionPercentage}%)</span>
                                      <span>-${fee.toFixed(2)}</span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between text-success fw-bold">
                                      <span>Tu Ganancia</span>
                                      <span>${net.toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detalles adicionales del otro participante */}
                      <div className="mt-4 pt-3 border-top">
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-secondary bg-opacity-10 p-2 rounded-circle">
                            <FaUser className="text-secondary" />
                          </div>
                          <div>
                            <small className="text-muted d-block">
                              {isDriver ? 'Pasajero' : 'Conductor'}
                            </small>
                            <span className="fw-medium text-dark">
                              {isDriver ? (trip.userName || 'Usuario') : (trip.driverName || 'Por asignar')}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTrips;
