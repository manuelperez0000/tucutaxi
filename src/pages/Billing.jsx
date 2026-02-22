import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { FaMoneyBillWave, FaClock, FaCheckCircle, FaExclamationCircle, FaArrowLeft, FaUniversity, FaMobileAlt, FaCopy } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ConfirmationModal from '../components/ConfirmationModal';

const Billing = ({ user }) => {
  const [unpaidTrips, setUnpaidTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [totalDebt, setTotalDebt] = useState(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'primary'
  });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

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

  useEffect(() => {
    const fetchUnpaidTrips = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // 0. Verificar si es conductor
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || !userSnap.data().hasVehicle) {
            toast.error("Acceso denegado: Esta sección es solo para conductores.");
            navigate('/my-trips');
            return;
        }

        // 1. Obtener porcentaje de comisión global (o del perfil del conductor si fuera personalizado)
        const settingsRef = doc(db, 'settings', 'general');
        const settingsSnap = await getDoc(settingsRef);
        let currentCommission = 0;
        if (settingsSnap.exists()) {
          currentCommission = settingsSnap.data().servicePercentage || 0;
          setCommissionPercentage(currentCommission);
        }

        // 2. Buscar viajes completados del conductor que NO estén pagados
        // Se asume que commissionStatus no existe o es false
        const q = query(
          collection(db, 'taxiRequests'),
          where('driverId', '==', user.uid),
          where('status', '==', 'completed'),
          where('commissionStatus', '==', false) 
        );

        const querySnapshot = await getDocs(q);
        const trips = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Ordenar por fecha descendente
        trips.sort((a, b) => {
            const dateA = a.completedAt?.toDate() || a.createdAt?.toDate() || new Date(0);
            const dateB = b.completedAt?.toDate() || b.createdAt?.toDate() || new Date(0);
            return dateB - dateA;
        });

        setUnpaidTrips(trips);

        // Calcular deuda total
        let debt = 0;
        trips.forEach(trip => {
            if (trip.price) {
                // Usar el porcentaje guardado en el viaje si existe, sino el actual
                const pct = trip.servicePercentage !== undefined ? trip.servicePercentage : currentCommission;
                const fee = (trip.price * pct) / 100;
                debt += fee;
            }
        });
        setTotalDebt(debt);

      } catch (error) {
        console.error("Error al cargar facturación:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUnpaidTrips();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // Manejar tanto Timestamp de Firestore como Date de JS (si se guardó localmente en pruebas)
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleReportPayment = async () => {
    if (!referenceNumber.trim()) {
      toast.warning("Por favor, ingresa el número de referencia del pago.");
      return;
    }

    if (!user) return;

    setConfirmModal({
      isOpen: true,
      title: "Reportar Pago",
      message: `¿Estás seguro de reportar el pago por un monto de $${totalDebt.toFixed(2)}?`,
      variant: 'success',
      confirmText: 'Reportar Pago',
      onConfirm: executeReportPayment
    });
  };

  const executeReportPayment = async () => {
    closeConfirmModal();
    try {
      setIsSubmitting(true);

      // 1. Preparar datos del pago
      const paymentData = {
        driverId: user.uid,
        driverName: user.displayName || 'Conductor',
        driverEmail: user.email || '',
        driverPhone: user.phoneNumber || '', // Ajustar según donde guardes el teléfono
        amount: totalDebt,
        referenceNumber: referenceNumber.trim(),
        createdAt: serverTimestamp(),
        status: 'pending', // pending, approved, rejected
        tripIds: unpaidTrips.map(trip => trip.id),
        tripsCount: unpaidTrips.length
      };

      // 2. Guardar en colección 'payments'
      await addDoc(collection(db, 'payments'), paymentData);

      // 3. Actualizar estado de los viajes a 'pending_approval'
      const batch = writeBatch(db);
      unpaidTrips.forEach(trip => {
        const tripRef = doc(db, 'taxiRequests', trip.id);
        batch.update(tripRef, { commissionStatus: 'pending_approval' });
      });
      await batch.commit();

      toast.success("Pago reportado exitosamente. Tu pago está sujeto a verificación.");
      setShowPaymentModal(false);
      setReferenceNumber('');
      
      setUnpaidTrips([]);
      setTotalDebt(0);
      
      navigate('/my-trips');

    } catch (error) {
      console.error("Error al reportar pago:", error);
      toast.error("Hubo un error al reportar el pago. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.info("Copiado al portapapeles: " + text);
  };

  return (
    <div className="vh-100 d-flex flex-column bg-light">
      <Navbar user={user} />
      
      <div className="container py-4 flex-grow-1 overflow-auto">
        
        {/* Encabezado y Botón de Volver */}
        <div className="d-flex align-items-center justify-content-between mb-4">
            <div className="d-flex align-items-center gap-3">
                <button className="btn btn-outline-secondary rounded-circle" onClick={() => navigate('/my-trips')}>
                    <FaArrowLeft />
                </button>
                <h2 className="fw-bold mb-0">Facturación</h2>
            </div>
            
            {unpaidTrips.length > 0 && (
                <button 
                    className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 py-2 shadow-sm fw-bold"
                    onClick={() => setShowPaymentModal(true)}
                >
                    <FaMoneyBillWave /> Pagar Deuda (${totalDebt.toFixed(2)})
                </button>
            )}
        </div>

        {loading ? (
           <div className="text-center py-5">
             <div className="spinner-border text-primary" role="status">
               <span className="visually-hidden">Cargando...</span>
             </div>
           </div>
        ) : unpaidTrips.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-4 shadow-sm">
                <div className="bg-success bg-opacity-10 rounded-circle p-4 d-inline-block mb-3">
                    <FaCheckCircle className="text-success display-4" />
                </div>
                <h4 className="fw-bold text-dark">¡Estás al día!</h4>
                <p className="text-muted">No tienes comisiones pendientes de pago.</p>
            </div>
        ) : (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="py-3 ps-4 border-0 text-muted small text-uppercase">Fecha y Hora</th>
                                <th className="py-3 border-0 text-muted small text-uppercase">Viaje ID</th>
                                <th className="py-3 border-0 text-muted small text-uppercase text-end">Monto Viaje</th>
                                <th className="py-3 border-0 text-muted small text-uppercase text-end">Comisión</th>
                                <th className="py-3 pe-4 border-0 text-muted small text-uppercase text-end">Monto a Pagar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unpaidTrips.map(trip => {
                                const pct = trip.servicePercentage !== undefined ? trip.servicePercentage : commissionPercentage;
                                const fee = (trip.price * pct) / 100;

                                return (
                                    <tr key={trip.id}>
                                        <td className="ps-4 py-3">
                                            <div className="d-flex align-items-center gap-2">
                                                <FaClock className="text-muted" />
                                                <span className="fw-medium">{formatDate(trip.completedAt || trip.createdAt)}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-muted">
                                            <small className="font-monospace bg-light px-2 py-1 rounded border">
                                                {trip.tripId || trip.id.substring(0, 6)}
                                            </small>
                                        </td>
                                        <td className="py-3 text-end fw-medium">${trip.price}</td>
                                        <td className="py-3 text-end text-muted small">{pct}%</td>
                                        <td className="pe-4 py-3 text-end fw-bold text-danger">
                                            ${fee.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-light">
                            <tr>
                                <td colSpan="4" className="text-end py-3 fw-bold text-uppercase text-muted">Total Deuda:</td>
                                <td className="text-end py-3 pe-4 fw-black fs-5 text-danger">${totalDebt.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        )}

      </div>

      {/* Modal de Pago */}
      {showPaymentModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh' }}>
                <div className="card-header bg-primary text-white p-4 text-center border-0">
                    <h4 className="fw-bold mb-0">Realizar Pago</h4>
                    <p className="mb-0 opacity-75 small">Reporta tu pago para saldar tu deuda</p>
                </div>
                <div className="card-body p-4 overflow-auto">
                    
                    <div className="text-center mb-4">
                        <small className="text-muted text-uppercase fw-bold">Monto Total a Transferir</small>
                        <h1 className="display-4 fw-bold text-primary mb-0">${totalDebt.toFixed(2)}</h1>
                    </div>

                    <div className="alert alert-warning d-flex align-items-start gap-2 small">
                        <FaExclamationCircle className="mt-1 flex-shrink-0" />
                        <div>
                            Por favor realiza la transferencia o pago móvil por el monto exacto y conserva tu comprobante.
                        </div>
                    </div>

                    <h6 className="fw-bold text-muted text-uppercase small mb-3 border-bottom pb-2">Datos Bancarios</h6>

                    {/* Transferencia */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <FaUniversity className="text-primary" />
                            <span className="fw-bold">Transferencia Bancaria</span>
                        </div>
                        <div className="bg-light p-3 rounded-3 small">
                            <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">Banco:</span>
                                <span className="fw-medium text-end">{paymentData.bank.bankName}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">Titular:</span>
                                <span className="fw-medium text-end">{paymentData.bank.accountHolder}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">C.I / RIF:</span>
                                <span className="fw-medium text-end">{paymentData.bank.idNumber}</span>
                            </div>
                            <div className="mt-2 pt-2 border-top">
                                <span className="text-muted d-block mb-1">Número de Cuenta:</span>
                                <div className="d-flex align-items-center gap-2">
                                    <code className="flex-grow-1 text-dark fw-bold">{paymentData.bank.accountNumber}</code>
                                    <button className="btn btn-sm btn-light border" onClick={() => copyToClipboard(paymentData.bank.accountNumber)} title="Copiar">
                                        <FaCopy size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pago Móvil */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <FaMobileAlt className="text-primary" />
                            <span className="fw-bold">Pago Móvil</span>
                        </div>
                        <div className="bg-light p-3 rounded-3 small">
                             <div className="row g-2">
                                 <div className="col-4">
                                     <span className="text-muted d-block text-xs">Banco</span>
                                     <div className="fw-bold">{paymentData.mobilePayment.bankCode}</div>
                                 </div>
                                 <div className="col-4">
                                     <span className="text-muted d-block text-xs">Cédula</span>
                                     <div className="fw-bold">{paymentData.mobilePayment.idNumber}</div>
                                 </div>
                                 <div className="col-4">
                                     <span className="text-muted d-block text-xs">Teléfono</span>
                                     <div className="d-flex align-items-center gap-1">
                                        <div className="fw-bold text-truncate">{paymentData.mobilePayment.phoneNumber}</div>
                                        <FaCopy className="text-muted cursor-pointer" size={10} onClick={() => copyToClipboard(paymentData.mobilePayment.phoneNumber)} />
                                     </div>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="form-label small text-muted fw-bold">Número de Referencia / Comprobante</label>
                        <input 
                            type="text" 
                            className="form-control form-control-lg bg-light border-0" 
                            placeholder="Ej: 12345678"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                        <div className="form-text small">Ingresa los últimos 6-8 dígitos del comprobante.</div>
                    </div>

                    <div className="d-grid gap-2">
                        <button 
                            className="btn btn-success py-3 fw-bold rounded-3 shadow-sm" 
                            onClick={handleReportPayment}
                            disabled={isSubmitting || !referenceNumber.trim()}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Enviando...
                                </>
                            ) : (
                                'Reportar Pago Realizado'
                            )}
                        </button>
                        <button className="btn btn-outline-secondary py-2 rounded-3" onClick={() => setShowPaymentModal(false)} disabled={isSubmitting}>
                            Cerrar
                        </button>
                    </div>

                </div>
            </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        loading={isSubmitting}
      />
    </div>
  );
};

export default Billing;