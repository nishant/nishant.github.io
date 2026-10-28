import { initTheme } from '@nish/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyStoredFont } from './lib/font';

// Applies the saved choice, follows the OS for "system", and keeps the theme-color meta in step.
initTheme();
applyStoredFont();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
