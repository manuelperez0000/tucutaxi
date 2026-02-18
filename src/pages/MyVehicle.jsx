import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import { FaCar, FaMotorcycle, FaCheckCircle, FaTimesCircle, FaClock, FaEdit, FaSnowflake, FaChair } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const MyVehicle = ({ user }) => {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicle = async () => {
      if (user?.uid) {
        try {
          const docRef = doc(db, 'vehicles', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setVehicle(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching vehicle:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchVehicle();
  }, [user]);

  if (loading) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar user={user} />
        <div className="d-flex justify-content-center align-items-center h-75 mt-5 pt-5">
          <div className="spinner-border text-warning" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar user={user} />
        <div className="container py-5 text-center">
          <div className="card border-0 shadow-sm rounded-4 p-5">
            <div className="mb-4">
                <FaCar className="text-muted display-1" />
            </div>
            <h3 className="fw-bold text-secondary">No tienes un vehículo registrado</h3>
            <p className="text-muted mb-4">Para poder trabajar como conductor, necesitas registrar tu vehículo.</p>
            <Link to="/register-vehicle" className="btn btn-warning fw-bold px-5 py-3 rounded-pill">
              Registrar Vehículo Ahora
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved':
        return <span className="badge bg-success rounded-pill px-3 py-2"><FaCheckCircle className="me-1" /> Aprobado</span>;
      case 'rejected':
        return <span className="badge bg-danger rounded-pill px-3 py-2"><FaTimesCircle className="me-1" /> Rechazado</span>;
      default:
        return <span className="badge bg-warning text-dark rounded-pill px-3 py-2"><FaClock className="me-1" /> Pendiente de Aprobación</span>;
    }
  };

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={user} />
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="card-header bg-dark text-white p-4 d-flex justify-content-between align-items-center">
                <h4 className="fw-bold mb-0">Mi Vehículo</h4>
                {getStatusBadge(vehicle.status)}
              </div>
              <div className="card-body p-0">
                <div className="bg-warning bg-opacity-10 p-4 text-center border-bottom border-warning border-opacity-25">
                  {vehicle.type === 'motorcycle' ? (
                    <FaMotorcycle className="display-1 text-warning mb-2" />
                  ) : (
                    <FaCar className="display-1 text-warning mb-2" />
                  )}
                  <h2 className="fw-bold text-dark mb-0">{vehicle.brand} {vehicle.model}</h2>
                  <p className="text-muted fs-5">{vehicle.year}</p>
                </div>

                <div className="p-4">
                  <h6 className="text-uppercase text-muted fw-bold small mb-3">Detalles Técnicos</h6>
                  
                  <div className="row g-3">
                    <div className="col-6">
                        <div className="p-3 bg-light rounded-3 h-100 border">
                            <small className="d-block text-muted mb-1">Tipo</small>
                            <span className="fw-bold text-capitalize">{vehicle.type === 'car' ? 'Automóvil' : 'Motocicleta'}</span>
                        </div>
                    </div>
                    {vehicle.type === 'car' && (
                        <>
                            <div className="col-6">
                                <div className="p-3 bg-light rounded-3 h-100 border">
                                    <small className="d-block text-muted mb-1">Aire Acondicionado</small>
                                    <span className="fw-bold d-flex align-items-center gap-2">
                                        <FaSnowflake className={vehicle.ac ? "text-info" : "text-secondary"} />
                                        {vehicle.ac ? "Sí" : "No"}
                                    </span>
                                </div>
                            </div>
                            <div className="col-12">
                                <div className="p-3 bg-light rounded-3 border">
                                    <small className="d-block text-muted mb-1">Estado de Asientos</small>
                                    <span className="fw-bold d-flex align-items-center gap-2">
                                        <FaChair className="text-secondary" />
                                        {vehicle.seats === 'excellent' && 'Excelente'}
                                        {vehicle.seats === 'good' && 'Bueno'}
                                        {vehicle.seats === 'fair' && 'Regular'}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                  </div>
                </div>
              </div>
              <div className="card-footer bg-white p-4 border-top-0">
                <div className="alert alert-info border-0 rounded-3 mb-0">
                  <small>
                    <FaClock className="me-2" />
                    Si editas tu vehículo, deberá pasar por aprobación nuevamente.
                  </small>
                </div>
                
                <div className="d-grid mt-3">
                    <Link to="/register-vehicle" className="btn btn-outline-dark rounded-pill py-2 fw-bold">
                        <FaEdit className="me-2" /> Editar Vehículo
                    </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyVehicle;