import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import NominatimService from '../services/nominatim';

const useDashboard = ({user}) => {

    const [loading, setLoading] = useState(false);
    const [activeTrip, setActiveTrip] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [countdown, setCountdown] = useState(null);
    const [showDestinationSelector, setShowDestinationSelector] = useState(false);
    const [destination, setDestination] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [pickupLocation, setPickupLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [userPhone, setUserPhone] = useState(null);
    const [userName, setUserName] = useState(null);
    const [userDni, setUserDni] = useState(null);
    const [fetchingProfile, setFetchingProfile] = useState(true);
    const [userState, setUserState] = useState(null);

    // Obtener perfil del usuario desde Firestore
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (user?.uid) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserPhone(data.phone || null);
                        setUserName(data.name || user.displayName || null);
                        setUserDni(data.dni || null);
                    } else {
                        // Si el documento no existe (nuevo usuario de Google), usar nombre de Google
                        setUserName(user.displayName || null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                } finally {
                    setFetchingProfile(false);
                }
            } else {
                setFetchingProfile(false);
            }
        };
        fetchUserProfile();
    }, [user]);

    const updateUserProfile = async (name, phone, dni) => {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            // Usar setDoc con merge: true por si el documento no existe
            const { setDoc } = await import('firebase/firestore'); 
            const updateData = {
                name,
                phone,
                email: user.email,
                updatedAt: serverTimestamp()
            };
            if (dni) updateData.dni = dni;

            await setDoc(userRef, updateData, { merge: true });
            
            setUserName(name);
            setUserPhone(phone);
            if (dni) setUserDni(dni);
            return true;
        } catch (error) {
            console.error("Error updating profile:", error);
            return false;
        }
    };


    // Ubicación por defecto (Coordenadas solicitadas por usuario)
    const DEFAULT_LOCATION = {
        lat: 9.05425221995597,
        lng: -62.05026626586915,
        address: 'Ubicación Inicial por Defecto'
    };

    // Obtener ubicación inicial del usuario
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError("Tu navegador no soporta geolocalización.");
            setUserLocation(DEFAULT_LOCATION);
            setPickupLocation(DEFAULT_LOCATION);
            return;
        }

        // Verificar permisos primero (opcional, pero buena práctica en navegadores modernos)
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'denied') {
                    setLocationError("Permiso de ubicación denegado. Por favor, habilítalo en la configuración de tu navegador.");
                }
            });
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserLocation(loc);
                setPickupLocation(loc);
                setLocationError(null); // Limpiar error si tiene éxito

                // Obtener el estado (provincia/región) basado en la ubicación
                NominatimService.reverseGeocode(loc.lat, loc.lng)
                    .then(data => {
                        if (data && data.address) {
                            const state = data.address.state || data.address.province;
                            if (state) {
                                console.log("Usuario localizado en:", state);
                                setUserState(state);
                            }
                        }
                    })
                    .catch(err => console.error("Error al obtener estado del usuario:", err));
            },
            (error) => {
                console.error("Error al obtener ubicación inicial:", error);
                let errorMsg = "No se pudo obtener tu ubicación.";
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = "Permiso de ubicación denegado. Habilita el GPS y los permisos del navegador.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = "La información de ubicación no está disponible. Verifica que tu GPS esté encendido.";
                        break;
                    case error.TIMEOUT:
                        errorMsg = "Se agotó el tiempo para obtener la ubicación.";
                        break;
                    default:
                        errorMsg = "Ocurrió un error desconocido al obtener la ubicación.";
                        break;
                }
                setLocationError(errorMsg);
                // Si falla, usar ubicación por defecto
                setUserLocation(DEFAULT_LOCATION);
                setPickupLocation(DEFAULT_LOCATION);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, []);

    // Escuchar si el usuario ya tiene un viaje pendiente o aceptado
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'taxiRequests'),
            where('userId', '==', user.uid),
            where('status', 'in', ['pending', 'offered', 'accepted', 'in_progress'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                // Tomamos el primer viaje activo encontrado
                const tripData = snapshot.docs[0].data();
                setActiveTrip({ id: snapshot.docs[0].id, ...tripData });

                // Fallback: Si hay conductor pero no teléfono en el viaje, buscarlo
                if (tripData.driverId && !tripData.driverPhone) {
                    getDoc(doc(db, 'users', tripData.driverId)).then(userDoc => {
                        if (userDoc.exists() && userDoc.data().phone) {
                            setActiveTrip(prev => ({ ...prev, driverPhone: userDoc.data().phone }));
                        }
                    }).catch(console.error);
                }
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

    const FORMAT_TIME = (seconds) => {
        if (seconds === null) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const generateTripId = () => {
        return Math.floor(10000 + Math.random() * 90000).toString();
    };

    const handleRequestTaxi = (vehicleType) => {
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
                        const data = await NominatimService.reverseGeocode(lat, lng);
                        address = data?.display_name || 'Ubicación sin nombre';
                    } catch (err) {
                        console.error("Error al obtener dirección:", err);
                        address = 'Ubicación seleccionada (Manual)';
                    }
                }

                const tripId = generateTripId();

                // Obtener el porcentaje de comisión de la configuración
                let servicePercentage = 0;
                try {
                    const settingsRef = doc(db, 'settings', 'general');
                    const settingsSnap = await getDoc(settingsRef);
                    if (settingsSnap.exists()) {
                        servicePercentage = settingsSnap.data().servicePercentage || 0;
                    }
                } catch (err) {
                    console.error("Error al obtener porcentaje de servicio:", err);
                }

                // Crear la solicitud en Firestore
                const requestData = {
                    userId: user.uid,
                    userName: user.displayName || 'Usuario',
                    userEmail: user.email || '',
                    userPhoto: user.photoURL || '',
                    userPhone: userPhone || '',
                    tripId: tripId,
                    vehicleType: vehicleType, // Nuevo campo
                    servicePercentage: servicePercentage, // Guardar el porcentaje actual
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

                // Notificar conductores con vehículo aprobado del mismo tipo
                try {
                    const vehiclesQuery = query(
                        collection(db, 'vehicles'),
                        where('type', '==', vehicleType),
                        where('status', '==', 'approved')
                    );
                    
                    const vehicleSnapshot = await getDocs(vehiclesQuery);
                    
                    const notificationsPromises = vehicleSnapshot.docs.map(doc => {
                        const driverId = doc.id; // El ID del doc es el UID del usuario
                        if (driverId === user.uid) return null; // No auto-notificar

                        return addDoc(collection(db, 'notifications'), {
                            userId: driverId,
                            title: 'Nueva Solicitud de Viaje',
                            body: `Un pasajero ha solicitado un viaje en ${vehicleType === 'motorcycle' ? 'Moto' : vehicleType === 'sedan' ? 'Sedán' : 'Camioneta'} cerca de ti.`,
                            tripId: tripId,
                            createdAt: serverTimestamp(),
                            read: false
                        });
                    }).filter(p => p !== null);

                    await Promise.all(notificationsPromises);
                } catch (notifError) {
                    console.error("Error enviando notificaciones:", notifError);
                    // No fallamos la solicitud principal si fallan las notificaciones
                }

                setMessage({ type: 'success', text: '¡Buscando tu conductor!' });
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
        setPickupLocation,
        locationError,
        userPhone,
        userName,
        userDni,
        fetchingProfile,
        updateUserProfile,
        userState
    }

}

export default useDashboard;