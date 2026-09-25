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

// A deploy replaces hashed chunks, so tabs opened before it 404 on lazy imports.
// Reload once to pick up the new build; the timestamp guard prevents a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'chunk-reload-at';
  try {
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

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
