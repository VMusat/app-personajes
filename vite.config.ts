/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona en GitHub Pages sea cual sea el nombre del repositorio
export default defineConfig({
  base: './',
  plugins: [react()],
  // dice-box carga sus web workers con rutas relativas: no debe pre-empaquetarse
  optimizeDeps: { exclude: ['@3d-dice/dice-box'] },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'node',
    testTimeout: 120000,
  },
})
