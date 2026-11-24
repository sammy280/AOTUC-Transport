import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Register Service Worker for Offline Application Shell (Phase 1)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[AOTUC App Shell] Service Worker registered with scope:', registration.scope);

        // Notify if an update is found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[AOTUC App Shell] New version available; will activate on reload.');
                } else {
                  console.log('[AOTUC App Shell] Application shell cached for offline access.');
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[AOTUC App Shell] Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
