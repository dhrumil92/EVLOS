import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { httpLiveViewSource } from './live-view-source.js';
import './styles.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no element with the id root.');
}

createRoot(root).render(
  <StrictMode>
    <App source={httpLiveViewSource} />
  </StrictMode>,
);
