import React from 'react';

const ConfirmationModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Confirmación", 
    message = "¿Estás seguro de realizar esta acción?", 
    confirmText = "Confirmar", 
    cancelText = "Cancelar",
    variant = "danger", // primary, danger, warning, success
    loading = false
}) => {
    if (!isOpen) return null;

    const getVariantClasses = () => {
        switch (variant) {
            case 'danger': return 'btn-danger';
            case 'warning': return 'btn-warning text-dark';
            case 'success': return 'btn-success';
            default: return 'btn-primary';
        }
    };

    return (
        <div 
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
            style={{ 
                zIndex: 9999, 
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(3px)'
            }}
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-4 shadow-lg p-4 animate__animated animate__fadeInUp" 
                style={{ maxWidth: '400px', width: '90%' }}
                onClick={e => e.stopPropagation()}
            >
                <h5 className="fw-bold mb-3 text-dark">{title}</h5>
                <p className="text-secondary mb-4">{message}</p>
                
                <div className="d-flex justify-content-end gap-2">
                    <button 
                        className="btn btn-light rounded-pill px-4 fw-bold" 
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className={`btn ${getVariantClasses()} rounded-pill px-4 fw-bold d-flex align-items-center gap-2`} 
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;