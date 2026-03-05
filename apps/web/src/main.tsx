import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from './api/client';
import './i18n';

const queryClient = new QueryClient();

function App() {
  const { t } = useTranslation();
  const healthQuery = useQuery({
    queryKey: ['healthz'],
    queryFn: apiClient.getHealthz,
    refetchInterval: 15_000
  });

  return (
    <main style={{ fontFamily: 'ui-sans-serif, system-ui', margin: '2rem auto', maxWidth: 760, lineHeight: 1.5 }}>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <p>
        Check backend health at <code>/api/v1/healthz</code>.
      </p>
      <p>
        Backend status:{' '}
        <strong>
          {healthQuery.isLoading
            ? 'checking'
            : healthQuery.isError
              ? 'unreachable'
              : healthQuery.data?.ok
                ? 'healthy'
                : 'unknown'}
        </strong>
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
