import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useState, useEffect } from 'react';

const useDashboard = ({user}) => {

    const [loading, setLoading] = useState(false);
    const [activeTrip, setActiveTrip] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [countdown, setCountdown] = useState(null);
    const [showDestinationSelector, setShowDestinationSelector] = useState(false);
    const [destination, setDestination] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [pickupLocation, setPickupLocation] = useState(null);


    // Ubicación por defecto (Plaza Independencia, San Miguel de Tucumán)
    const DEFAULT_LOCATION = {
        lat: -26.829,
        lng: -65.217,
        address: 'Plaza Independencia, San Miguel de Tucumán (Simulado)'
    };

    // Obtener ubicación inicial del usuario
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setUserLocation(loc);
                    setPickupLocation(loc);
                },
                (error) => {
                    console.error("Error al obtener ubicación inicial:", error);
                    // Si falla, usar ubicación por defecto pero sin notificar agresivamente al inicio
                    setUserLocation(DEFAULT_LOCATION);
                    setPickupLocation(DEFAULT_LOCATION);
                },
                { enableHighAccuracy: true }
            );
        } else {
            setUserLocation(DEFAULT_LOCATION);
            setPickupLocation(DEFAULT_LOCATION);
        }
    }, []);

    // Escuchar si el usuario ya tiene un viaje pendiente o aceptado
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'taxiRequests'),
            where('userId', '==', user.uid),
            where('status', 'in', ['pending', 'offered', 'accepted'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                // Tomamos el primer viaje activo encontrado
                const tripData = snapshot.docs[0].data();
                setActiveTrip({ id: snapshot.docs[0].id, ...tripData });
            } else {
                setActiveTrip(null);
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Manejar el temporizador de cuenta regresiva y cálculo de Google Distance Matrix
    useEffect(() => {
        let timer;

        const calculateETA = async () => {
            if (activeTrip?.status === 'accepted' && activeTrip.driverStartLocation && !activeTrip.driverArrived && countdown === null) {
                try {
                    // Coordenadas del pasajero y del conductor
                    const origin = `${activeTrip.driverStartLocation.lat},${activeTrip.driverStartLocation.lng}`;
                    const destination = `${activeTrip.location.lat},${activeTrip.location.lng}`;

                    // API Key de Google (usando la misma de Firebase que suele tener permisos para Maps)
                    const apiKey = "AIzaSyDRSDPUDAaQZqLAtsJtRnex5uhKBqWb5vw";

                    // Usar un proxy de CORS o llamar directamente si está configurado (aquí usamos el modo no-cors para evitar errores de preflight si es necesario, 
                    // aunque para una API Key real se suele usar un backend o configurar los origenes permitidos en Google Cloud Console)
                    const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`);
                    const data = await response.json();

                    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
                        const element = data.rows[0].elements[0];
                        const durationInSeconds = element.duration.value;

                        setCountdown(durationInSeconds);
                    } else {
                        // Fallback si la API falla o no devuelve resultados
                        const randomETA = Math.floor(Math.random() * (300 - 120 + 1)) + 120;
                        setCountdown(randomETA);
                    }
                } catch (error) {
                    console.error("Error al calcular ETA con Google:", error);
                    const randomETA = Math.floor(Math.random() * (300 - 120 + 1)) + 120;
                    setCountdown(randomETA);
                }
            }
        };

        if (activeTrip?.status === 'accepted' && !activeTrip.driverArrived) {
            calculateETA();

            timer = setInterval(() => {
                setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        } else {
            setCountdown(null);
        }

        return () => clearInterval(timer);
    }, [activeTrip?.status, activeTrip?.driverArrived, activeTrip?.driverStartLocation, activeTrip?.location, countdown]);

    const formatTime = (seconds) => {
        if (seconds === null) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const generateTripId = () => {
        return Math.floor(10000 + Math.random() * 90000).toString();
    };

    const handleRequestTaxi = () => {
        if (!destination || !pickupLocation) {
            setShowDestinationSelector(true);
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        // Función auxiliar para procesar la solicitud con coordenadas
        const processRequest = async (lat, lng, addressText = null) => {
            try {
                let address = addressText;
                
                // Si no tenemos dirección, intentamos geocodificar
                if (!address) {
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                        const data = await response.json();
                        address = data.display_name || 'Ubicación sin nombre';
                    } catch (err) {
                        console.error("Error al obtener dirección:", err);
                        address = 'Ubicación seleccionada (Manual)';
                    }
                }

                const tripId = generateTripId();

                // Crear la solicitud en Firestore
                const requestData = {
                    userId: user.uid,
                    userName: user.displayName || 'Usuario',
                    userEmail: user.email || '',
                    userPhoto: user.photoURL || '',
                    tripId: tripId,
                    location: {
                        latitude: lat,
                        longitude: lng
                    },
                    address: address, 
                    destination: {
                        latitude: destination.lat,
                        longitude: destination.lng,
                        address: destination.address
                    },
                    status: 'pending',
                    createdAt: serverTimestamp()
                };

                await addDoc(collection(db, 'taxiRequests'), requestData);

                setMessage({ type: 'success', text: '¡Buscando tu taxi!' });
                setShowDestinationSelector(false);
                setDestination(null);
                // No reseteamos pickupLocation, la dejamos por si quiere pedir otro
                
            } catch (error) {
                console.error("Error al guardar en Firebase:", error);
                setMessage({ type: 'danger', text: 'Error al enviar la solicitud. Intenta de nuevo.' });
            } finally {
                setLoading(false);
            }
        };

        // Si tenemos una ubicación de recogida explícita, la usamos
        if (pickupLocation) {
             processRequest(pickupLocation.lat, pickupLocation.lng, pickupLocation.address);
        } else {
             // Fallback a lógica anterior (aunque ahora pickupLocation debería estar siempre)
             if (!navigator.geolocation) {
                 processRequest(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, DEFAULT_LOCATION.address);
                 return;
             }
             // ... resto de lógica si hiciera falta ...
        }
    };

    const handleCancelTrip = async () => {
        if (!activeTrip) return;

        const confirmCancel = window.confirm("¿Estás seguro de que deseas cancelar tu solicitud de taxi?");
        if (!confirmCancel) return;

        try {
            const tripRef = doc(db, 'taxiRequests', activeTrip.id);
            await updateDoc(tripRef, {
                status: 'cancelled',
                cancelledAt: serverTimestamp()
            });
            setActiveTrip(null);
            setMessage({ type: 'success', text: 'Viaje cancelado correctamente.' });
        } catch (error) {
            console.error("Error al cancelar viaje:", error);
            setMessage({ type: 'danger', text: 'No se pudo cancelar el viaje.' });
        }
    };

    const handleViewDriverLocation = () => {
        if (!activeTrip?.driverStartLocation) return;
        const { lat, lng } = activeTrip.driverStartLocation;
        const url = `https://www.google.com/maps?q=${lat},${lng}`;
        window.open(url, '_blank');
    };

    const handleAcceptOffer = async () => {
        if (!activeTrip) return;
        try {
            const tripRef = doc(db, 'taxiRequests', activeTrip.id);
            await updateDoc(tripRef, {
                status: 'accepted',
                acceptedAt: serverTimestamp()
            });
            setMessage({ type: 'success', text: '¡Oferta aceptada! El conductor va en camino.' });
        } catch (error) {
            console.error("Error al aceptar oferta:", error);
            setMessage({ type: 'danger', text: 'No se pudo aceptar la oferta.' });
        }
    };

    const handleDeclineOffer = async () => {
        if (!activeTrip) return;
        try {
            const tripRef = doc(db, 'taxiRequests', activeTrip.id);
            // Si el pasajero rechaza, volvemos el viaje a pendiente para otros conductores
            // y borramos los datos del conductor actual
            await updateDoc(tripRef, {
                status: 'pending',
                driverId: null,
                driverName: null,
                driverPhoto: null,
                driverEmail: null,
                driverStartLocation: null,
                price: null,
                offeredAt: null
            });
            setMessage({ type: 'info', text: 'Oferta rechazada. Buscando otro conductor...' });
        } catch (error) {
            console.error("Error al rechazar oferta:", error);
            setMessage({ type: 'danger', text: 'No se pudo rechazar la oferta.' });
        }
    };



    return {
        loading,
        activeTrip,
        message,
        showDestinationSelector,
        setShowDestinationSelector,
        destination,
        userLocation,
        handleCancelTrip,
        handleRequestTaxi,
        handleViewDriverLocation,
        handleAcceptOffer,
        handleDeclineOffer,
        setDestination,
        pickupLocation,
        setPickupLocation
    }

}

export default useDashboard;