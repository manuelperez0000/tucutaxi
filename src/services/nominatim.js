/**
 * Servicio para interactuar con la API de Nominatim (OpenStreetMap)
 */

const NOMINATIM_BASE_URL = import.meta.env.VITE_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';

/**
 * Realiza una búsqueda de dirección (Geocodificación directa)
 * @param {string} query - La dirección a buscar
 * @param {number} limit - Límite de resultados (default 1)
 * @param {string} state - (Opcional) Estado para filtrar la búsqueda (e.g., "Bolívar")
 * @returns {Promise<Array>} - Lista de resultados
 */
export const searchAddress = async (query, limit = 1, state = null) => {
    if (!query) return [];
    
    try {
        let q = query;
        if (state && !q.toLowerCase().includes(state.toLowerCase())) {
            q = `${q}, ${state}`;
        }
        
        // countrycodes=ve restringe la búsqueda a Venezuela
        const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}&countrycodes=ve&addressdetails=1`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Nominatim API Error: ${response.status}`);
        }
        
        const results = await response.json();
        
        // Filtrado adicional en el cliente para asegurar que pertenece al estado correcto
        if (state && results.length > 0) {
            return results.filter(item => {
                const itemState = item.address?.state || item.address?.province || '';
                return itemState.toLowerCase().includes(state.toLowerCase());
            });
        }
        
        return results;
    } catch (error) {
        console.error("Error en searchAddress:", error);
        throw error;
    }
};

/**
 * Realiza una geocodificación inversa (Coordenadas a dirección)
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 * @param {number} zoom - Nivel de zoom (default 18)
 * @returns {Promise<Object>} - Resultado con detalles de la dirección
 */
export const reverseGeocode = async (lat, lng, zoom = 18) => {
    if (!lat || !lng) return null;
    
    try {
        const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Nominatim API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error en reverseGeocode:", error);
        throw error;
    }
};

export default {
    searchAddress,
    reverseGeocode
};
