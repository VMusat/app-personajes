import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos.css'
import App from './App'
import { aplicarApariencia, seguirSistema } from './ui/temas'

// La apariencia elegida se aplica antes de pintar para que no haya parpadeo
aplicarApariencia()
seguirSistema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
