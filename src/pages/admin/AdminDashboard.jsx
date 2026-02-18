import React from 'react';
import { FaUsers, FaCar, FaRoute, FaMoneyBillWave } from 'react-icons/fa';

const StatCard = ({ title, value, icon, color }) => (
  <div className="col-md-3 mb-4">
    <div className={`card border-0 shadow-sm border-start border-4 border-${color} h-100`}>
      <div className="card-body d-flex align-items-center justify-content-between">
        <div>
          <h6 className="text-muted text-uppercase mb-2 small fw-bold">{title}</h6>
          <h3 className="mb-0 fw-bold">{value}</h3>
        </div>
        <div className={`bg-${color} bg-opacity-10 p-3 rounded-circle text-${color}`}>
          {icon}
        </div>
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  return (
    <div>
      <h2 className="fw-bold mb-4">Resumen General</h2>
      
      <div className="row">
        <StatCard title="Usuarios Totales" value="1,250" icon={<FaUsers size={24} />} color="primary" />
        <StatCard title="Conductores Activos" value="48" icon={<FaCar size={24} />} color="warning" />
        <StatCard title="Viajes Hoy" value="156" icon={<FaRoute size={24} />} color="info" />
        <StatCard title="Ganancias del Mes" value="$12,450" icon={<FaMoneyBillWave size={24} />} color="success" />
      </div>

      <div className="row mt-4">
        <div className="col-lg-8 mb-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 py-3">
              <h5 className="fw-bold m-0">Actividad Reciente</h5>
            </div>
            <div className="card-body">
              <p className="text-muted text-center py-5">Gráfico de actividad próximamente...</p>
            </div>
          </div>
        </div>
        <div className="col-lg-4 mb-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 py-3">
              <h5 className="fw-bold m-0">Solicitudes Pendientes</h5>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                  <div>
                    <h6 className="mb-0 fw-bold">Juan Pérez</h6>
                    <small className="text-muted">Registro de Vehículo</small>
                  </div>
                  <span className="badge bg-warning text-dark rounded-pill">Pendiente</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                  <div>
                    <h6 className="mb-0 fw-bold">María Garcia</h6>
                    <small className="text-muted">Verificación de Identidad</small>
                  </div>
                  <span className="badge bg-warning text-dark rounded-pill">Pendiente</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
