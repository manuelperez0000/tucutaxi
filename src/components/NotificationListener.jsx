import { useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

const NotificationListener = ({ user }) => {
  useEffect(() => {
    if (!user) return;

    // Request notification permission
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = change.doc.data();
          
          if (Notification.permission === 'granted') {
            new Notification(notification.title || 'Nueva Notificación', {
              body: notification.body || '',
              icon: '/giro.ico' // Assuming this exists in public folder
            });
          }

          // Mark as read immediately to avoid re-notifying on reload
          // Or we can leave it unread until clicked. For now, mark as read to prevent spam on refresh.
          // But usually we want to keep it in a list.
          // Let's just mark it read for this simple implementation.
          try {
            updateDoc(doc(db, 'notifications', change.doc.id), {
              read: true
            });
          } catch (error) {
            console.error("Error marking notification as read:", error);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  return null; // This component doesn't render anything visible
};

export default NotificationListener;
