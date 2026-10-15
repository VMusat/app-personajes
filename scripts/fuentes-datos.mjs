// Lee la lista de archivos y la versión de src/datos/fuentes.ts sin compilar TypeScript.
import { readFileSync } from 'node:fs'
const ts = readFileSync(new URL('../src/datos/fuentes.ts', import.meta.url), 'utf8')
const version = ts.match(/VERSION_5ETOOLS = '([^']+)'/)[1]
const clases = [...ts.match(/CLASES_5ETOOLS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const otros = [...ts.match(/ARCHIVOS_5ETOOLS = \[([\s\S]*?)\n\]/)[1].matchAll(/'([^']+\.json)'/g)].map((m) => m[1])
export const URL_BASE = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${version}/data/`
export const ARCHIVOS = [...clases.map((c) => `class/class-${c}.json`), ...otros]
