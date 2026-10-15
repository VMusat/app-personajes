// Copia los recursos de los dados 3D (texturas, física) a public/ para servirlos con la app.
import { cpSync, existsSync } from 'node:fs'
const origen = 'node_modules/@3d-dice/dice-box/dist/assets'
const destino = 'public/assets/dice-box'
if (existsSync(origen)) cpSync(origen, destino, { recursive: true })
