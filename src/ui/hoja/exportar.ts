// Exportación del personaje: nota para la carpeta Personajes/ de Obsidian y copia de seguridad en JSON.
import type { Datos } from '../../datos/tipos'
import type { Hoja } from '../../motor/derivar'
import type { Personaje } from '../../motor/personaje'
import { CARACTERISTICAS } from '../../datos/tipos'
import { ABREV, conSigno } from '../glosario'

export function descargar(nombre: string, contenido: string, tipo = 'text/markdown') {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const limpiarNombre = (s: string) => s.replace(/[#^[\]|\\/:*?"<>]/g, '').trim() || 'Personaje'

/** Nota con la plantilla «Personaje» de la bóveda (propiedades en español). */
export function notaObsidian(p: Personaje, h: Hoja, d: Datos): string {
  const especie = d.especies.find((e) => e._clave === p.especie)?._nombre ?? ''
  const trasfondo = d.trasfondos.find((t) => t._clave === p.trasfondo)?._nombre ?? ''
  const clases = h.resolucion.clases.map((c) => `${c.clase._nombre}${c.subclase ? ` (${c.subclase._nombre})` : ''} ${c.nivel}`).join(' / ')
  const objetosDestacados = p.inventario.filter((i) => i.origen === 'campaña' || i.sintonizado)
  const yaml = [
    '---',
    'tipo: personaje',
    'aliases: []',
    'tags: []',
    `jugador: ${p.jugador || ''}`,
    'estado: vivo',
    `raza: ${especie}`,
    `clase: ${clases}`,
    `nivel: ${h.nivel}`,
    `trasfondo: ${trasfondo}`,
    'faccion:',
    `aspecto: ${p.aspecto ?? ''}`,
    '---',
  ].join('\n')
  const car = CARACTERISTICAS.map((c) => `${ABREV[c]} ${h.car[c].valor} (${conSigno(h.car[c].mod)})`).join(' · ')
  return `${yaml}
# ${p.nombre}

## Concepto
${p.detalles.apariencia ?? ''}
${p.detalles.personalidad ? `\n${p.detalles.personalidad}` : ''}

## Trasfondo
${trasfondo}. ${p.detalles.historia ?? ''}

## Ganchos y objetivos
- ${p.detalles.ideales ?? ''}

## Relaciones
- ${p.detalles.vinculos ?? ''}

## Objetos destacados
${objetosDestacados.map((i) => `- ${i.origen === 'campaña' ? `[[${i.nombre}]]` : i.nombre}`).join('\n') || '- '}

## Ficha
- **${clases}** · nivel ${h.nivel} · ${especie} · aspecto ${p.aspecto ?? '—'}
- HP ${h.pgMax} · AC ${h.ca.valor} · Iniciativa ${conSigno(h.iniciativa)} · Velocidad ${h.velocidad.andar} ft · PB ${conSigno(h.pb)}
- ${car}
- Habilidades: ${h.habilidades.filter((s) => s.competente).map((s) => `${s.nombre} ${conSigno(s.bono)}`).join(', ')}
- Dotes: ${h.resolucion.dotes.map((f) => f._nombre).join(', ') || '—'}

## Notas del DM
-
`
}

export function exportarObsidian(p: Personaje, h: Hoja, d: Datos) {
  descargar(`${limpiarNombre(p.nombre)}.md`, notaObsidian(p, h, d))
}

export function exportarJSON(p: Personaje) {
  descargar(`${limpiarNombre(p.nombre)}.json`, JSON.stringify(p, null, 2), 'application/json')
}
