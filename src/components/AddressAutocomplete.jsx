import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import NominatimService from '../services/nominatim';

const AddressAutocomplete = ({ 
    placeholder, 
    value, 
    onChange, 
    onSelect, 
    userState,
    autoFocus = false,
    icon = <FaSearch />
}) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        // Cerrar sugerencias al hacer clic fuera
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (value && value.length > 2 && showSuggestions) {
                setLoading(true);
                try {
                    const results = await NominatimService.searchAddress(value, 5, userState);
                    setSuggestions(results);
                } catch (error) {
                    console.error("Error fetching suggestions:", error);
                    setSuggestions([]);
                } finally {
                    setLoading(false);
                }
            } else if (!value) {
                setSuggestions([]);
            }
        }, 500); // Debounce de 500ms

        return () => clearTimeout(timer);
    }, [value, userState, showSuggestions]);

    const handleSelect = (item) => {
        onSelect(item);
        setShowSuggestions(false);
    };

    const handleInputChange = (e) => {
        onChange(e.target.value);
        setShowSuggestions(true);
    };

    return (
        <div className="position-relative w-100" ref={wrapperRef}>
            <div className="input-group shadow-sm rounded-4 overflow-hidden bg-white">
                <span className="input-group-text bg-white border-0 ps-3">
                    {loading ? <span className="spinner-border spinner-border-sm text-secondary" role="status"></span> : <span className="text-secondary">{icon}</span>}
                </span>
                <input
                    type="text"
                    className="form-control border-0 py-3 shadow-none"
                    placeholder={placeholder}
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    autoFocus={autoFocus}
                />
                {value && (
                    <button 
                        className="btn bg-white border-0 pe-3 text-secondary"
                        onClick={() => {
                            onChange('');
                            setSuggestions([]);
                        }}
                    >
                        <FaTimes />
                    </button>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="position-absolute w-100 mt-2 bg-white rounded-4 shadow-lg overflow-hidden" style={{ zIndex: 1050, maxHeight: '300px', overflowY: 'auto' }}>
                    <ul className="list-group list-group-flush">
                        {suggestions.map((item, index) => (
                            <li 
                                key={index} 
                                className="list-group-item list-group-item-action p-3 cursor-pointer border-bottom-0"
                                onClick={() => handleSelect(item)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-light rounded-circle p-2">
                                        <FaMapMarkerAlt className="text-secondary" />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark text-truncate" style={{ maxWidth: '280px' }}>
                                            {item.display_name.split(',')[0]}
                                        </div>
                                        <small className="text-muted d-block text-truncate" style={{ maxWidth: '280px' }}>
                                            {item.display_name}
                                        </small>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AddressAutocomplete;