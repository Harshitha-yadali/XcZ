import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary';
import { capturePendingReferralCode } from './utils/referralCapture';

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

capturePendingReferralCode();

// After a deploy, an open tab asks for page files that no longer exist (or a
// fetch blips). Reload once to get the new build instead of an error screen.
const reloadOnceForNewBuild = () => {
  try {
    if (sessionStorage.getItem('pb-chunk-reload')) return;
    sessionStorage.setItem('pb-chunk-reload', '1');
  } catch { /* storage blocked: reload anyway */ }
  window.location.reload();
};
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadOnceForNewBuild(); });
window.addEventListener('load', () => setTimeout(() => { try { sessionStorage.removeItem('pb-chunk-reload'); } catch { /* ignore */ } }, 10000));
(window as unknown as { pbReloadOnceForNewBuild: () => void }).pbReloadOnceForNewBuild = reloadOnceForNewBuild;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </HelmetProvider>
  </ErrorBoundary>
);
