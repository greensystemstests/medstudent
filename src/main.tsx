import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installImageFallback } from './lib/imageFallback';
import { installErrorReporting } from './lib/reportError';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SiteContentProvider } from './lib/siteContent';

installImageFallback();
installErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SiteContentProvider>
        <App />
      </SiteContentProvider>
    </ErrorBoundary>
  </StrictMode>,
);
