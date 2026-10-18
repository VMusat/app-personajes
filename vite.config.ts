/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// En desarrollo, al guardar la Guía en Obsidian se vuelve a copiar y la página se actualiza sola
function vigilarGuia(): Plugin {
  const nota = path.resolve(__dirname, '..', 'Campaign', 'Lore', 'Guía para aventureros de los Reinos de la Miasma.md')
  return {
    name: 'vigilar-guia',
    apply: 'serve',
    configureServer() {
      if (process.env.VITEST || !fs.existsSync(nota)) return
      let espera: ReturnType<typeof setTimeout> | undefined
      // Se vigila la carpeta y no el archivo: Obsidian y otros editores guardan sustituyendo el archivo
      fs.watch(path.dirname(nota), (_evento, archivo) => {
        if (archivo !== path.basename(nota)) return
        clearTimeout(espera)
        espera = setTimeout(() => execFile(process.execPath, [path.resolve(__dirname, 'scripts', 'copiar-guia.mjs')]), 200)
      })
    },
  }
}

// base relativa: funciona en GitHub Pages sea cual sea el nombre del repositorio
export default defineConfig({
  base: './',
  plugins: [react(), vigilarGuia()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'node',
    testTimeout: 120000,
  },
})
