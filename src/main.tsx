import { AppErrorBoundary, initTheme } from '@nish/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { isPushHost } from './features/inbox/push';
import { applyStoredFont } from './lib/font';

// Applies the saved choice, follows the OS for "system", and keeps the theme-color meta in step.
initTheme();
applyStoredFont();

// The service worker (web push for the Inbox) only runs on the start page and local hosts.
if ('serviceWorker' in navigator && isPushHost()) {
  const registerWorker = () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => registration.update())
      .catch(() => undefined);
  };
  // After load, so the precache does not compete with the first render's requests.
  if (document.readyState === 'complete') registerWorker();
  else window.addEventListener('load', registerWorker, { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
