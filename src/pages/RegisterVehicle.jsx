import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { FaCar, FaMotorcycle, FaCheckCircle, FaSpinner, FaEdit } from 'react-icons/fa';

const RegisterVehicle = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleType, setVehicleType] = useState('car'); // 'car' | 'motorcycle'
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    seats: '',
    ac: 'yes', // 'yes' | 'no'
  });

  useEffect(() => {
    const fetchVehicle = async () => {
      if (user?.uid) {
        try {
          const docRef = doc(db, 'vehicles', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setIsEditing(true);
            setVehicleType(data.type);
            setFormData({
              brand: data.brand || '',
              model: data.model || '',
              year: data.year || '',
              seats: data.seats || '',
              ac: data.ac ? 'yes' : 'no'
            });
          }
        } catch (error) {
          console.error("Error fetching vehicle:", error);
        }
      }
    };
    fetchVehicle();
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const vehicleData = {
        userId: user.uid,
        type: vehicleType,
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        // Si editamos, mantenemos el status actual o lo cambiamos a 'pending' si es necesario.
        // Asumiremos que si edita, vuelve a revisión.
        status: 'pending' 
      };

      if (!isEditing) {
        vehicleData.createdAt = serverTimestamp();
      } else {
        vehicleData.updatedAt = serverTimestamp();
      }

      if (vehicleType === 'car') {
        vehicleData.seats = formData.seats;
        vehicleData.ac = formData.ac === 'yes';
      }

      // Guardar en la colección de vehículos
      // Usamos setDoc con merge: true para no borrar campos que no estemos tocando (aunque aquí tocamos casi todos)
      await setDoc(doc(db, 'vehicles', user.uid), vehicleData, { merge: true });

      // Actualizar el perfil del usuario
      await updateDoc(doc(db, 'users', user.uid), {
        hasVehicle: true,
        isDriverApproved: false // Vuelve a pendiente
      });

      navigate('/my-vehicle');
    } catch (error) {
      console.error("Error al registrar vehículo:", error);
      alert("Hubo un error al registrar tu vehículo. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Navbar user={user} />
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="card-header bg-dark text-white p-4 text-center">
                <h3 className="fw-bold mb-0">{isEditing ? 'Editar Vehículo' : 'Registra tu Vehículo'}</h3>
                <p className="mb-0 opacity-75">{isEditing ? 'Actualiza los datos de tu vehículo.' : 'Para comenzar a conducir, necesitamos los datos de tu vehículo.'}</p>
              </div>
              <div className="card-body p-4 p-md-5">
                
                <div className="d-flex justify-content-center gap-3 mb-4">
                  <button 
                    className={`btn flex-grow-1 py-3 rounded-3 d-flex flex-column align-items-center gap-2 ${vehicleType === 'car' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setVehicleType('car')}
                    type="button"
                  >
                    <FaCar size={24} />
                    Carro
                  </button>
                  <button 
                    className={`btn flex-grow-1 py-3 rounded-3 d-flex flex-column align-items-center gap-2 ${vehicleType === 'motorcycle' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setVehicleType('motorcycle')}
                    type="button"
                  >
                    <FaMotorcycle size={24} />
                    Moto
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-uppercase text-muted">Marca</label>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-3" 
                        placeholder="Ej: Toyota"
                        name="brand"
                        value={formData.brand}
                        onChange={handleChange}
                        required 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-uppercase text-muted">Modelo</label>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-3" 
                        placeholder="Ej: Corolla"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        required 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small text-uppercase text-muted">Año</label>
                      <input 
                        type="number" 
                        className="form-control bg-light border-0 py-3" 
                        placeholder="Ej: 2015"
                        name="year"
                        value={formData.year}
                        onChange={handleChange}
                        required 
                      />
                    </div>

                    {vehicleType === 'car' && (
                      <>
                        <div className="col-md-6">
                          <label className="form-label fw-bold small text-uppercase text-muted">Estado de Asientos</label>
                          <select 
                            className="form-select bg-light border-0 py-3"
                            name="seats"
                            value={formData.seats}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Seleccionar...</option>
                            <option value="excellent">Excelente</option>
                            <option value="good">Bueno</option>
                            <option value="fair">Regular</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-bold small text-uppercase text-muted">Aire Acondicionado</label>
                          <div className="d-flex gap-3">
                            <div className="form-check">
                              <input 
                                className="form-check-input" 
                                type="radio" 
                                name="ac" 
                                id="ac_yes" 
                                value="yes"
                                checked={formData.ac === 'yes'}
                                onChange={handleChange}
                              />
                              <label className="form-check-label" htmlFor="ac_yes">
                                Sí, tiene A/C funcional
                              </label>
                            </div>
                            <div className="form-check">
                              <input 
                                className="form-check-input" 
                                type="radio" 
                                name="ac" 
                                id="ac_no" 
                                value="no"
                                checked={formData.ac === 'no'}
                                onChange={handleChange}
                              />
                              <label className="form-check-label" htmlFor="ac_no">
                                No tiene / No funciona
                              </label>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-5">
                    <button 
                      type="submit" 
                      className="btn btn-dark w-100 py-3 fw-bold rounded-pill shadow-sm"
                      disabled={loading}
                    >
                      {loading ? (
                        <><FaSpinner className="animate-spin me-2" /> Guardando...</>
                      ) : (
                        <>{isEditing ? 'Actualizar Vehículo' : 'Registrar Vehículo'} <FaCheckCircle className="ms-2" /></>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterVehicle;