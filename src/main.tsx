import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

const dsn = import.meta.env.VITE_SENTRY_DSN
if (dsn) {
  Sentry.init({ dsn })
}
// ponytail: no-op when VITE_SENTRY_DSN is unset (dev/test) instead of throwing.

const SentryApp = Sentry.withErrorBoundary(App, { fallback: <p>Terjadi kesalahan. Silakan muat ulang halaman.</p> })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryApp />
  </StrictMode>,
)
