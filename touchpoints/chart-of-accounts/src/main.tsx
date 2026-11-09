import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { installColumnHoverHint } from './lib/columnHoverHint'
import { EmbeddingBridge } from './EmbeddingBridge'

installColumnHoverHint()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* basename: the shell serves this app under /touchpoint-apps/chart-of-accounts/ (see src/embedding.ts). */}
    <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EmbeddingBridge />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
