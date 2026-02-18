import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { FaUser, FaSearch, FaSpinner, FaTrash, FaEdit, FaEnvelope, FaPhone, FaIdCard } from 'react-icons/fa';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        // Intenta ordenar por fecha de creación, si falla (por falta de índice), hace fallback
        try {
          const q = query(usersRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          const usersList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setUsers(usersList);
        } catch (indexError) {
          console.warn("Index not found or sorting error, fetching unsorted:", indexError);
          const querySnapshot = await getDocs(usersRef);
          const usersList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setUsers(usersList);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.dni && user.dni.includes(searchTerm)) ||
    (user.phone && user.phone.includes(searchTerm))
  );

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
    return '-';
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <FaSpinner className="spinner-border text-warning display-4" />
    </div>
  );

  return (
    <div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h2 className="fw-bold m-0">Gestión de Usuarios</h2>
          <p className="text-muted m-0 small">Total de usuarios registrados: {users.length}</p>
        </div>
        
        <div className="input-group shadow-sm" style={{ maxWidth: '300px' }}>
          <span className="input-group-text bg-white border-end-0"><FaSearch className="text-muted" /></span>
          <input 
            type="text" 
            className="form-control border-start-0 ps-0" 
            placeholder="Buscar por nombre, email, DNI..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                <th className="border-0 py-3">Fecha Registro</th>
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
                    <td>
                      <span className="text-muted small">{formatDate(user.createdAt)}</span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group">
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
