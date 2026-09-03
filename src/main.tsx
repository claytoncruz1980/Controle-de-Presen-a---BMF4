import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for mobile and PC installation, automatic updates and offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Immediate check for newer version on launch
        registration.update().catch(() => {});

        // Listen for new updates found
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available, activate it immediately
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            };
          }
        };

        // Periodic background update check every 10 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 10 * 60 * 1000);

        // Check for updates when user returns to the app tab / window
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        console.log('BMF4 PWA Service Worker registrado com sucesso:', registration.scope);
      })
      .catch((err) => {
        console.warn('Falha ao registrar Service Worker do PWA:', err);
      });

    // Auto reload when a new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
