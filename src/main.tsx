import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {RemoteApp} from './RemoteApp.tsx';
import './index.css';

/**
 * The same bundle serves the instrument and the phone that controls it.
 *
 * The remote server marks the page it hands out; in development the phone loads
 * from Vite instead, where the flag rides in the address. The desktop window
 * loads over file:// and sees neither.
 */
const isRemote =
  (window as any).__MIDIMOO_REMOTE__ === true ||
  new URLSearchParams(window.location.search).has('remote');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRemote ? <RemoteApp /> : <App />}
  </StrictMode>,
);
