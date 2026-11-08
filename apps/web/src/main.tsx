import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { httpAuthSource } from './auth-source.js';
import { httpLiveViewSource } from './live-view-source.js';
import { LoginGate } from './LoginGate.js';
import { httpPublicLiveSource } from './public-live-source.js';
import { PublicLiveViewPage } from './PublicLiveView.js';
import { ResetPasswordPage } from './ResetPasswordPage.js';
import './styles.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no element with the id root.');
}

// The link in a password reset email opens /reset-password?token=... The token is read once
// and removed from the address bar, so it is not left in the browser's history.
const isResetPage = window.location.pathname === '/reset-password';
// The Public Live View (FR-17) needs no login, so it is shown without the login gate.
const isPublicLive = window.location.pathname === '/live';
const resetToken = new URLSearchParams(window.location.search).get('token') ?? '';
if (isResetPage) {
  window.history.replaceState(null, '', '/reset-password');
}

createRoot(root).render(
  <StrictMode>
    {isResetPage ? (
      <ResetPasswordPage auth={httpAuthSource} token={resetToken} />
    ) : isPublicLive ? (
      <PublicLiveViewPage source={httpPublicLiveSource} />
    ) : (
      <LoginGate auth={httpAuthSource}>
        {(logOut) => <App source={httpLiveViewSource} onLogOut={logOut} />}
      </LoginGate>
    )}
  </StrictMode>,
);
