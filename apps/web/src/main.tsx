import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { httpAuthSource } from './auth-source.js';
import { httpLiveViewSource } from './live-view-source.js';
import { LoginGate } from './LoginGate.js';
import './styles.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no element with the id root.');
}

createRoot(root).render(
  <StrictMode>
    <LoginGate auth={httpAuthSource}>
      {(logOut) => <App source={httpLiveViewSource} onLogOut={logOut} />}
    </LoginGate>
  </StrictMode>,
);
