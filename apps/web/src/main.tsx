import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import './i18n';

const queryClient = new QueryClient();

function App() {
  const { t } = useTranslation();

  return (
    <main style={{ fontFamily: 'ui-sans-serif, system-ui', margin: '2rem auto', maxWidth: 760, lineHeight: 1.5 }}>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <p>
        Check backend health at <code>/api/v1/healthz</code>.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
