import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PortalProvider } from './state/PortalContext';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Portal root element not found.');

createRoot(root).render(
  <StrictMode>
    <PortalProvider>
      <App />
    </PortalProvider>
  </StrictMode>,
);
