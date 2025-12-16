importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSy...", // Replaced by build/env if possible, but for SW usually hardcoded or imported from config if strict.
    // For this prototype, rely on client-side registration mostly. 
    // BUT the SW needs config to wake up.
    // NOTE: In production, better to serve this file dynamically or use env vars replacer during build.
    // For now, I'll attempt to use the same logic as the app if I can, but SW runs in separate context.
    // Using a generic "listeners only" approach or placeholders if not essential for *foreground* messages.
    // Background messages usually handled by system if payload has 'notification' key.
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png' // Make sure this exists
    };

    self.registration.showNotification(notificationTitle,
        notificationOptions);
});
