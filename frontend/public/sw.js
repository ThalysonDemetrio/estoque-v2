self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body || 'Você tem uma nova notificação.',
        icon: data.icon || '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200, 100, 200], // Vibração padrão de notificação
        data: {
          url: data.url || '/'
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'Stellarnet', options)
      );
    } catch (e) {
      console.error('[SW Push Error] Parse falhou', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver uma aba aberta, focaliza ela e navega
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          if (urlToOpen) client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Se não, abre uma nova janela/aba
      if (clients.openWindow && urlToOpen) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
