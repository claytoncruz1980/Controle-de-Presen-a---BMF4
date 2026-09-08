import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service Worker registration: only enabled in production builds to prevent
// stale dev module caching, duplicate React copies, and hook dispatcher errors
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.update().catch(() => {});
          console.log('BMF4 PWA Service Worker registrado com sucesso:', registration.scope);
        })
        .catch((err) => {
          console.warn('Falha ao registrar Service Worker do PWA:', err);
        });
    });
  } else {
    // In development mode, ensure any stale service worker is completely unregistered
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name).catch(() => {});
        }
      }).catch(() => {});
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
