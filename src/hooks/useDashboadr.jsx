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


    // Obtener ubicación inicial del usuario
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => console.error("Error al obtener ubicación inicial:", error),
                { enableHighAccuracy: true }
            );
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
        if (!destination) {
            setShowDestinationSelector(true);
            return;
        }

        if (!navigator.geolocation) {
            setMessage({ type: 'danger', text: 'Tu navegador no soporta geolocalización.' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;

                    // Obtener dirección legible usando OpenStreetMap (Nominatim)
                    let address = 'Ubicación desconocida';
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                        const data = await response.json();
                        address = data.display_name || 'Ubicación sin nombre';
                    } catch (err) {
                        console.error("Error al obtener dirección:", err);
                    }

                    const tripId = generateTripId();

                   
                    // Crear la solicitud en Firestore
                    const requestData = {
                        userId: user.uid,
                        userName: user.displayName,
                        userEmail: user.email,
                        userPhoto: user.photoURL,
                        tripId: tripId,
                        location: {
                            latitude,
                            longitude
                        },
                        address: address,
                        destination: {
                            latitude: destination.location.lat,
                            longitude: destination.location.lng,
                            address: destination.address
                        },
                        status: 'pending',
                        createdAt: serverTimestamp()
                    };

                    await addDoc(collection(db, 'taxiRequests'), requestData);

                    setMessage({ type: 'success', text: '¡Buscando tu taxi!' });
                    setShowDestinationSelector(false);
                    setDestination(null);
                    
                } catch (error) {
                    console.error("Error al guardar en Firebase:", error);
                    setMessage({ type: 'danger', text: 'Error al enviar la solicitud. Intenta de nuevo.' });
                } finally {
                    setLoading(false);
                }
            },
            (error) => {
                setLoading(false);
                console.error("Error de geolocalización:", error);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setMessage({ type: 'danger', text: 'Debes permitir el acceso al GPS para pedir un taxi.' });
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setMessage({ type: 'danger', text: 'La ubicación no está disponible.' });
                        break;
                    case error.TIMEOUT:
                        setMessage({ type: 'danger', text: 'Se agotó el tiempo para obtener la ubicación.' });
                        break;
                    default:
                        setMessage({ type: 'danger', text: 'Ocurrió un error al obtener tu ubicación.' });
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
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
        setDestination
    }

}

export default useDashboard;