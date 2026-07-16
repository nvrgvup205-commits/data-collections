import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { migrateLegacyPortalUrl } from './lib/companies'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import './index.css'

migrateLegacyPortalUrl()

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
