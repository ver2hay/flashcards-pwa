import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for offline support (served from /sw.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        // Registration successful
        console.log('Service worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}
