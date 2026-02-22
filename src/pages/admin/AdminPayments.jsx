import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, orderBy, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FaCheckCircle, FaTimesCircle, FaSearch, FaFileInvoiceDollar, FaCalendarAlt, FaUser } from 'react-icons/fa';
import { toast } from 'react-toastify';
import ConfirmationModal from '../../components/ConfirmationModal';

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'primary'
  });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const paymentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPayments(paymentsData);
    } catch (error) {
      console.error("Error al cargar pagos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayment = (payment) => {
    setConfirmModal({
      isOpen: true,
      title: "Aprobar Pago",
      message: `¿Estás seguro de aprobar el pago de $${payment.amount} del conductor ${payment.driverName}?`,
      variant: 'success',
      onConfirm: () => executeApprovePayment(payment)
    });
  };

  const executeApprovePayment = async (payment) => {
    closeConfirmModal();

    try {
      setProcessingId(payment.id);

      // 1. Actualizar estado del pago
      const paymentRef = doc(db, 'payments', payment.id);
      await updateDoc(paymentRef, {
        status: 'approved',
        approvedAt: serverTimestamp()
      });

      // 2. Actualizar estado de los viajes asociados
      if (payment.tripIds && payment.tripIds.length > 0) {
        const batch = writeBatch(db);
        payment.tripIds.forEach(tripId => {
          const tripRef = doc(db, 'taxiRequests', tripId);
          batch.update(tripRef, { commissionStatus: 'paid' });
        });
        await batch.commit();
      }

      // Actualizar estado local
      setPayments(prevPayments => 
        prevPayments.map(p => 
          p.id === payment.id ? { ...p, status: 'approved' } : p
        )
      );

      toast.success("Pago aprobado correctamente.");

    } catch (error) {
      console.error("Error al aprobar pago:", error);
      toast.error("Hubo un error al aprobar el pago.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayment = (payment) => {
    setConfirmModal({
      isOpen: true,
      title: "Rechazar Pago",
      message: `¿Estás seguro de rechazar el pago de $${payment.amount}? Esta acción revertirá el estado de los viajes.`,
      variant: 'danger',
      onConfirm: () => executeRejectPayment(payment)
    });
  };

  const executeRejectPayment = (payment) => {
    closeConfirmModal();
    
    setTimeout(async () => {
        const reason = prompt("Ingrese el motivo del rechazo (opcional):") || "Rechazado por administrador";
        
        try {
            setProcessingId(payment.id);

            // 1. Actualizar estado del pago
            const paymentRef = doc(db, 'payments', payment.id);
            await updateDoc(paymentRef, {
                status: 'rejected',
                rejectionReason: reason,
                rejectedAt: serverTimestamp()
            });

            // 2. Revertir estado de los viajes a false (pendiente de pago)
            if (payment.tripIds && payment.tripIds.length > 0) {
                const batch = writeBatch(db);
                payment.tripIds.forEach(tripId => {
                  const tripRef = doc(db, 'taxiRequests', tripId);
                  batch.update(tripRef, { commissionStatus: false });
                });
                await batch.commit();
            }

            // Actualizar estado local
            setPayments(prevPayments => 
                prevPayments.map(p => 
                p.id === payment.id ? { ...p, status: 'rejected' } : p
                )
            );

            toast.info("Pago rechazado. La deuda ha vuelto a ser pendiente para el conductor.");

        } catch (error) {
            console.error("Error al rechazar pago:", error);
            toast.error("Hubo un error al rechazar el pago.");
        } finally {
            setProcessingId(null);
        }
    }, 100);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredPayments = payments.filter(payment => 
    payment.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.driverEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">Gestión de Pagos</h2>
          <p className="text-muted">Administra los reportes de pago de comisiones</p>
        </div>
        <div className="d-flex gap-2">
           {/* Filtros o botones adicionales si fueran necesarios */}
        </div>
      </div>

      {/* Stats Cards (Opcional) */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
            <div className="card border-0 shadow-sm p-3">
                <div className="d-flex align-items-center">
                    <div className="bg-warning bg-opacity-10 p-3 rounded-circle text-warning">
                        <FaFileInvoiceDollar size={24} />
                    </div>
                    <div className="ms-3">
                        <h6 className="text-muted mb-0">Pendientes</h6>
                        <h3 className="fw-bold mb-0">{payments.filter(p => p.status === 'pending').length}</h3>
                    </div>
                </div>
            </div>
        </div>
        <div className="col-md-4">
            <div className="card border-0 shadow-sm p-3">
                <div className="d-flex align-items-center">
                    <div className="bg-success bg-opacity-10 p-3 rounded-circle text-success">
                        <FaCheckCircle size={24} />
                    </div>
                    <div className="ms-3">
                        <h6 className="text-muted mb-0">Aprobados</h6>
                        <h3 className="fw-bold mb-0">{payments.filter(p => p.status === 'approved').length}</h3>
                    </div>
                </div>
            </div>
        </div>
        <div className="col-md-4">
            <div className="card border-0 shadow-sm p-3">
                <div className="d-flex align-items-center">
                    <div className="bg-danger bg-opacity-10 p-3 rounded-circle text-danger">
                        <FaTimesCircle size={24} />
                    </div>
                    <div className="ms-3">
                        <h6 className="text-muted mb-0">Rechazados</h6>
                        <h3 className="fw-bold mb-0">{payments.filter(p => p.status === 'rejected').length}</h3>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="card-header bg-white border-bottom p-3">
            <div className="row align-items-center">
                <div className="col-md-6">
                    <h5 className="mb-0 fw-bold">Historial de Pagos</h5>
                </div>
                <div className="col-md-6">
                    <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                            <FaSearch className="text-muted" />
                        </span>
                        <input 
                            type="text" 
                            className="form-control bg-light border-start-0" 
                            placeholder="Buscar por conductor, referencia..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>
        
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr>
                <th className="py-3 ps-4 border-0">Fecha</th>
                <th className="py-3 border-0">Conductor</th>
                <th className="py-3 border-0">Referencia</th>
                <th className="py-3 border-0 text-end">Monto</th>
                <th className="py-3 border-0 text-center">Viajes</th>
                <th className="py-3 border-0 text-center">Estado</th>
                <th className="py-3 pe-4 border-0 text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                    <td colSpan="7" className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Cargando...</span>
                        </div>
                    </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                        No se encontraron pagos registrados.
                    </td>
                </tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment.id}>
                    <td className="ps-4 py-3">
                        <div className="d-flex align-items-center gap-2">
                            <FaCalendarAlt className="text-muted small" />
                            <span className="fw-medium">{formatDate(payment.createdAt)}</span>
                        </div>
                    </td>
                    <td className="py-3">
                        <div className="d-flex flex-column">
                            <span className="fw-bold text-dark">{payment.driverName}</span>
                            <small className="text-muted">{payment.driverPhone}</small>
                        </div>
                    </td>
                    <td className="py-3">
                        <span className="badge bg-light text-dark border font-monospace">
                            {payment.referenceNumber}
                        </span>
                    </td>
                    <td className="py-3 text-end">
                        <span className="fw-bold text-success fs-6">
                            ${parseFloat(payment.amount).toFixed(2)}
                        </span>
                    </td>
                    <td className="py-3 text-center">
                        <span className="badge bg-secondary rounded-pill">
                            {payment.tripsCount || payment.tripIds?.length || 0}
                        </span>
                    </td>
                    <td className="py-3 text-center">
                        {payment.status === 'pending' && <span className="badge bg-warning text-dark">Pendiente</span>}
                        {payment.status === 'approved' && <span className="badge bg-success">Aprobado</span>}
                        {payment.status === 'rejected' && <span className="badge bg-danger">Rechazado</span>}
                    </td>
                    <td className="pe-4 py-3 text-end">
                        {payment.status === 'pending' && (
                            <div className="d-flex justify-content-end gap-2">
                                <button 
                                    className="btn btn-sm btn-success d-flex align-items-center gap-1"
                                    onClick={() => handleApprovePayment(payment)}
                                    disabled={processingId === payment.id}
                                    title="Aprobar Pago"
                                >
                                    {processingId === payment.id ? (
                                        <span className="spinner-border spinner-border-sm" />
                                    ) : (
                                        <FaCheckCircle />
                                    )}
                                    <span className="d-none d-md-inline">Aprobar</span>
                                </button>
                                <button 
                                    className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                                    onClick={() => handleRejectPayment(payment)}
                                    disabled={processingId === payment.id}
                                    title="Rechazar Pago"
                                >
                                    <FaTimesCircle />
                                </button>
                            </div>
                        )}
                        {payment.status !== 'pending' && (
                            <span className="text-muted small fst-italic">
                                {payment.status === 'approved' ? 'Procesado' : 'Rechazado'}
                            </span>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        loading={!!processingId}
      />
    </div>
  );
};

export default AdminPayments;
