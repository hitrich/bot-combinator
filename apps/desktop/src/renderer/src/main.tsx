import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from './lib/router';
import { App } from './App';
import { WorkspaceProvider } from './state/WorkspaceContext';
import './styles/global.css';

const storedTheme = window.localStorage.getItem('bot-combinator.theme');
document.documentElement.dataset.theme =
  storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'light';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Bot Combinator could not find its application root.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>
  </React.StrictMode>,
);
