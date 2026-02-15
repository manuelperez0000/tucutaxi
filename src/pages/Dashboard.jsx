
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import LocationSelector from '../components/LocationSelector';
import { FaTaxi, FaSpinner, FaTimes, FaClock, FaUserCircle, FaStar, FaPhoneAlt, FaMapMarkerAlt, FaMapMarkedAlt } from 'react-icons/fa';
import useDashboard from '../hooks/useDashboadr';

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
    setPickupLocation
  } = useDashboard({ user });

  const [selectionStep, setSelectionStep] = useState('idle'); // 'idle', 'pickup', 'destination'

  // Si el hook pide mostrar el selector (por validación fallida), iniciamos el flujo
  useEffect(() => {
    if (showDestinationSelector) {
        setSelectionStep('pickup');
        setShowDestinationSelector(false);
    }
  }, [showDestinationSelector, setShowDestinationSelector]);

  const handlePickupSelected = (location) => {
      setPickupLocation(location);
      setSelectionStep('destination');
  };

  const handleDestinationSelected = (location) => {
      setDestination(location);
      setSelectionStep('idle');
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' }}>
      <Navbar user={user} />

      <main className="container-fluid mt-auto d-flex flex-column align-items-center p-0">
        <div className="card2 border-0 shadow-lg text-center p-4 w-100" style={{ borderRadius: '30px 30px 0 0', backgroundColor: 'rgba(255, 246, 246, 0.72)' }}>

          <div className="container-md">
            {message.text && (
              <div className={`alert alert-${message.type} py-2 small mb-3`} role="alert">
                {message.text}
              </div>
            )}

            <div className="row justify-content-center mb-3">
              <div className="col-12 col-md-8 col-lg-6">
                {!activeTrip ? (
                  <>
                    <p className="text-muted mb-4 text-start text-md-center">¿A dónde quieres ir hoy?</p>

                    <div className="animate__animated animate__fadeIn">
                      {/* Botón inicial para comenzar el flujo de selección */}
                      {!destination && selectionStep === 'idle' && (
                        <button
                          className="btn btn-outline-dark btn-lg py-3 fw-bold d-flex align-items-center justify-content-center gap-2 w-100 mb-3"
                          onClick={() => setSelectionStep('pickup')}
                          style={{ borderRadius: '15px', borderStyle: 'dashed' }}
                        >
                          <FaMapMarkedAlt />
                          Seleccionar Destino
                        </button>
                      )}

                      {/* Paso 1: Selección de Ubicación Actual (Pickup) */}
                      {selectionStep === 'pickup' && (
                        <div className="mb-3 animate__animated animate__slideInUp">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <h6 className="fw-bold mb-0">Confirma tu ubicación de recogida</h6>
                            <button className="btn btn-sm btn-close" onClick={() => setSelectionStep('idle')}></button>
                          </div>
                          <LocationSelector
                            initialLocation={pickupLocation || userLocation}
                            onLocationSelected={handlePickupSelected}
                            title="¿Dónde te buscamos?"
                            placeholder="Buscar dirección de recogida..."
                            confirmText="Confirmar Recogida"
                            confirmButtonColor="btn-dark"
                            iconColorClass="text-primary"
                          />
                        </div>
                      )}

                      {/* Paso 2: Selección de Destino */}
                      {selectionStep === 'destination' && (
                        <div className="mb-3 animate__animated animate__slideInUp">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <h6 className="fw-bold mb-0">Elige tu destino</h6>
                            <button className="btn btn-sm btn-close" onClick={() => setSelectionStep('pickup')}></button>
                          </div>
                          <LocationSelector
                            initialLocation={destination || userLocation} // O userLocation como centro por defecto
                            onLocationSelected={handleDestinationSelected}
                            title="¿A dónde vas?"
                            placeholder="Buscar destino..."
                            confirmText="Confirmar Destino"
                            confirmButtonColor="btn-warning"
                            iconColorClass="text-danger"
                          />
                        </div>
                      )}

                      {/* Resumen del viaje (cuando ambos están seleccionados y estamos en idle) */}
                      {destination && pickupLocation && selectionStep === 'idle' && (
                        <div className="card border-0 shadow-sm mb-3 text-start" style={{ borderRadius: '15px', backgroundColor: '#f8f9fa' }}>
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <span className="badge bg-dark-subtle text-dark text-uppercase px-2 py-1" style={{ fontSize: '0.7rem' }}>
                                Información del Viaje
                              </span>
                              <button 
                                className="btn btn-sm btn-link text-danger p-0 text-decoration-none fw-bold"
                                onClick={() => {
                                  setDestination(null);
                                  setSelectionStep('pickup'); // Reiniciar flujo
                                }}
                                style={{ fontSize: '0.8rem' }}
                              >
                                <FaTimes className="me-1" /> Cambiar
                              </button>
                            </div>
                            
                            {/* Pickup Info */}
                            <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom">
                              <div className="bg-white p-2 rounded-circle shadow-sm">
                                <FaMapMarkerAlt className="text-primary fs-5" />
                              </div>
                              <div>
                                <p className="small text-muted mb-0">Recogida:</p>
                                <p className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem', lineHeight: '1.2' }}>
                                  {pickupLocation?.address || 'Ubicación actual'}
                                </p>
                              </div>
                            </div>

                            {/* Destination Info */}
                            <div className="d-flex align-items-center gap-3">
                              <div className="bg-white p-2 rounded-circle shadow-sm">
                                <FaMapMarkedAlt className="text-warning fs-5" />
                              </div>
                              <div>
                                <p className="small text-muted mb-0">Destino:</p>
                                <p className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem', lineHeight: '1.2' }}>
                                  {destination?.address}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="d-grid gap-2">
                        <button
                          className="btn btn-dark btn-lg py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 w-100"
                          onClick={handleRequestTaxi}
                          disabled={loading || !destination || !pickupLocation || selectionStep !== 'idle'}
                          style={{ borderRadius: '15px' }}
                        >
                          {loading ? (
                            <FaSpinner className="spinner-border spinner-border-sm border-0" />
                          ) : (
                            <FaTaxi />
                          )}
                          {loading ? 'Procesando...' : 'Confirmar y Pedir Taxi'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-light p-3 rounded-4 shadow-sm border mt-2">
                    {activeTrip.status === 'pending' ? (
                      <div className="text-center py-2">
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                          <FaClock className="text-warning spinner-grow spinner-grow-sm border-0" />
                          <span className="fw-bold">Esperando un conductor...</span>
                        </div>
                        <div className="mb-4 bg-white p-4 rounded-4 shadow-sm border border-2 border-warning d-inline-block w-100">
                          <small className="text-muted d-block text-uppercase fw-bold ls-1 mb-1">Tu ID de Viaje</small>
                          <span className="display-3 fw-black text-dark tracking-tighter" style={{ fontFamily: 'monospace', letterSpacing: '4px' }}>
                            {activeTrip.tripId}
                          </span>
                        </div>
                      </div>
                    ) : activeTrip.status === 'offered' ? (
                      <div className="text-center py-2">
                        <div className="alert alert-warning border-0 rounded-4 py-3 mb-4 shadow-sm">
                          <h5 className="fw-bold mb-2">¡Nueva Oferta Recibida!</h5>
                          <p className="mb-0">El conductor ha propuesto un precio para tu viaje.</p>
                        </div>

                        <div className="bg-white p-4 rounded-4 shadow-sm border border-2 border-warning mb-4">
                          <small className="text-muted d-block text-uppercase fw-bold mb-1">Precio Propuesto</small>
                          <span className="display-2 fw-black text-dark">$ {activeTrip.price}</span>
                        </div>

                        <div className="bg-white p-3 rounded-4 border shadow-sm mb-4 d-flex align-items-center gap-3 text-start">
                          {activeTrip.driverPhoto ? (
                            <img src={activeTrip.driverPhoto} alt={activeTrip.driverName} className="rounded-circle" style={{ width: '50px', height: '50px' }} />
                          ) : (
                            <FaUserCircle className="text-secondary" style={{ fontSize: '50px' }} />
                          )}
                          <div>
                            <h6 className="mb-0 fw-bold">{activeTrip.driverName}</h6>
                            <div className="text-warning small">
                              <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                            </div>
                          </div>
                        </div>

                        <div className="d-grid gap-2">
                          <button className="btn btn-dark btn-lg rounded-pill fw-bold py-3" onClick={handleAcceptOffer}>
                            Aceptar Carrera
                          </button>
                          <button className="btn btn-outline-secondary rounded-pill fw-bold" onClick={handleDeclineOffer}>
                            Rechazar y seguir buscando
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-start">
                        {activeTrip.driverArrived && (
                          <div className="alert alert-success border-0 rounded-4 text-center py-3 mb-3 shadow-sm animate__animated animate__pulse animate__infinite">
                            <h5 className="fw-bold mb-1"><FaMapMarkerAlt className="me-2" /> ¡Tu conductor ha llegado!</h5>
                            <small>Por favor, acércate al punto de recogida.</small>
                          </div>
                        )}

                        <div className="d-flex align-items-center gap-2 mb-3 justify-content-center text-success">
                          <FaTaxi />
                          <span className="fw-bold">{activeTrip.driverArrived ? 'Esperándote en el punto' : 'Conductor en camino'}</span>
                        </div>



                        {/* Tarjeta del Conductor */}
                        <div className="bg-white p-3 rounded-4 border shadow-sm mb-3 d-flex align-items-center gap-3">
                          {activeTrip.driverPhoto ? (
                            <img
                              src={activeTrip.driverPhoto}
                              alt={activeTrip.driverName}
                              className="rounded-circle border"
                              style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                            />
                          ) : (
                            <FaUserCircle className="text-secondary" style={{ fontSize: '60px' }} />
                          )}
                          <div className="flex-grow-1">
                            <h6 className="mb-0 fw-bold">{activeTrip.driverName}</h6>
                            <div className="d-flex align-items-center gap-1 text-warning small">
                              <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                              <span className="text-muted ms-1">(4.9)</span>
                            </div>
                            <small className="text-muted">{activeTrip.driverEmail}</small>
                            {activeTrip.driverStartLocation && (
                              <button
                                onClick={handleViewDriverLocation}
                                className="btn btn-link p-0 text-dark text-decoration-none small d-flex align-items-center gap-1 mt-1"
                              >
                                <FaMapMarkerAlt className="text-danger" />
                                <span>Ver ubicación inicial</span>
                              </button>
                            )}
                          </div>
                          <button className="btn btn-dark rounded-circle p-2 shadow-sm">
                            <FaPhoneAlt size={18} />
                          </button>
                        </div>

                        <div className="mb-4 text-center bg-white p-3 rounded-4">
                          <small className="text-muted d-block text-uppercase fw-bold ls-1 mb-1">Id de viaje</small>
                          <span className="display-4 fw-black text-dark" style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
                            {activeTrip.tripId}
                          </span>
                          {activeTrip.price && (
                            <div className="mt-2 text-success fw-bold fs-4">
                              Precio pactado: ${activeTrip.price}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-start mb-4 bg-white p-3 rounded-3 border">
                      <div className="mb-2 pb-2 border-bottom">
                        <small className="text-muted d-block mb-1">Recogida en:</small>
                        <p className="small mb-0 text-dark fw-medium lh-sm text-truncate">{activeTrip.address}</p>
                      </div>
                      <div className="pt-1">
                        <small className="text-muted d-block mb-1">Destino:</small>
                        <p className="small mb-0 text-dark fw-medium lh-sm text-truncate">
                          {activeTrip.destination?.address || 'No especificado'}
                        </p>
                      </div>
                    </div>

                    <button
                      className="btn btn-outline-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                      onClick={handleCancelTrip}
                      style={{ borderRadius: '12px' }}
                    >
                      <FaTimes /> Cancelar Viaje
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
