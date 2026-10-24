// Exportación del personaje: nota para la carpeta Personajes/ de Obsidian y copia de seguridad en JSON.
import type { Caracteristica, Crudo, Datos } from '../../datos/tipos'
import type { Hoja } from '../../motor/derivar'
import type { Personaje } from '../../motor/personaje'
import { textoPlano } from '../../motor/resolver'
import type { ObjetoCampaña } from '../../almacen/objetosCampaña'
import { CARACTERISTICAS } from '../../datos/tipos'
import { ABREV, MONEDAS, MONEDA_SETTING, NIVEL_CONJURO, RECARGA, conSigno } from '../glosario'

export function descargar(nombre: string, contenido: string, tipo = 'text/markdown') {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const limpiarNombre = (s: string) => s.replace(/[#^[\]|\\/:*?"<>]/g, '').trim() || 'Personaje'

const MODOS_VELOCIDAD: Record<string, string> = { andar: 'Speed', vuelo: 'Fly', nado: 'Swim', trepar: 'Climb', excavar: 'Burrow' }

/** Texto escrito por el jugador, sin espacios sobrantes. */
const texto = (s?: string) => (s ?? '').trim()

/** Lista de Markdown, o «- » vacío como en la plantilla. */
const lista = (items: string[]) => (items.length ? items.map((x) => `- ${x}`).join('\n') : '- ')

/** Dinero con los nombres del setting: «27 sellos (GP) · 4 estrellas (SP)». */
export function dineroSetting(m: Personaje['monedas']): string {
  const partes = MONEDAS.filter((k) => (m[k] ?? 0) > 0).map((k) => {
    const n = m[k]
    const s = MONEDA_SETTING[k]
    return s ? `${n} ${n === 1 ? s[0] : s[1]} (${k.toUpperCase()})` : `${n} ${k.toUpperCase()}`
  })
  if (m.ep) partes.push(`${m.ep} EP (sin cambiar)`)
  return partes.join(' · ') || 'sin dinero'
}

/** Nota con la plantilla «Personaje» de la bóveda (propiedades en español) y la ficha completa. */
export function notaObsidian(p: Personaje, h: Hoja, d: Datos, catalogo: ObjetoCampaña[] = []): string {
  const r = h.resolucion
  const especie = d.especies.find((e) => e._clave === p.especie)
  const trasfondo = d.trasfondos.find((t) => t._clave === p.trasfondo)
  const linaje = p.elecciones['esp:variante']?.[0]
  const clases = r.clases.map((c) => `${c.clase._nombre}${c.subclase ? ` (${c.subclase._nombre})` : ''} ${c.nivel}`).join(' / ')
  const det = p.detalles

  // ── Frontmatter (compatible con Campaña.base)
  const yaml = [
    '---',
    'tipo: personaje',
    'aliases: []',
    'tags: []',
    `jugador: ${p.jugador || ''}`,
    'estado: vivo',
    `raza: ${especie?._nombre ?? ''}`,
    `clase: ${clases}`,
    `nivel: ${h.nivel}`,
    `trasfondo: ${trasfondo?._nombre ?? ''}`,
    'faccion:',
    `aspecto: ${p.aspecto ?? ''}`,
    '---',
  ].join('\n')

  // ── Concepto y trasfondo escritos por el jugador
  const concepto = [
    texto(det.apariencia),
    texto(det.personalidad) && `**Personalidad:** ${texto(det.personalidad)}`,
    texto(det.ideales) && `**Ideales:** ${texto(det.ideales)}`,
    texto(det.vinculos) && `**Vínculos:** ${texto(det.vinculos)}`,
    texto(det.defectos) && `**Defectos:** ${texto(det.defectos)}`,
    [texto(det.alineamiento) && `**Alineamiento:** ${texto(det.alineamiento)}`, texto(det.edad) && `**Edad:** ${texto(det.edad)}`].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n\n')
  const historia = [
    trasfondo ? `**${trasfondo._nombre}.** ${texto(trasfondo._setting as string | undefined)}`.trim() : '',
    texto(det.historia),
  ].filter(Boolean).join('\n\n')
  const notasJugador = p.notas.filter((n) => texto(n.texto)).map((n) => `**${n.titulo || 'Nota'}** (${n.fecha.slice(0, 10)}): ${texto(n.texto)}`)

  // ── Objetos destacados: de la campaña, sintonizados o mágicos
  const defObjeto = (ref?: string) => d.objetos.find((o) => o._clave === ref)
  const magico = (o?: Crudo) => !!o?.rarity && !['none', 'unknown', 'unknown (magic)'].includes(o.rarity)
  const destacados = p.inventario
    .filter((i) => i.origen === 'campaña' || i.sintonizado || magico(defObjeto(i.ref)))
    .map((i) => {
      const camp = i.origen === 'campaña' ? catalogo.find((o) => o.id === i.ref) : undefined
      const nombre = i.origen === 'campaña' ? `[[${camp?.nombre ?? i.nombre}]]` : i.nombre
      return `${nombre}${i.sintonizado ? ' (sintonizado)' : i.equipado ? ' (equipado)' : ''}${i.notas ? `: ${texto(i.notas)}` : ''}`
    })

  // ── Ficha
  const f: string[] = []
  const vel = Object.entries(h.velocidad).map(([m, v]) => `${MODOS_VELOCIDAD[m] ?? m} ${v} ft`).join(', ')
  f.push(`- **${clases}** · nivel ${h.nivel} · ${especie?._nombre ?? '—'}${linaje ? ` (${linaje})` : ''} · aspecto ${p.aspecto ?? '—'}`)
  f.push(`- HP ${h.pgMax} · AC ${h.ca.valor} (${h.ca.detalle}) · Iniciativa ${conSigno(h.iniciativa)} · ${vel} · PB ${conSigno(h.pb)}`)
  f.push(`- Hit Dice: ${h.dadosGolpe.map((x) => `${x.total}d${x.caras}`).join(' + ')}${r.tamaño ? ` · Tamaño ${r.tamaño.nombre}${r.tamaño.altura ? ` (unos ${r.tamaño.altura})` : ''}` : ''}`)

  f.push('', '### Características y salvaciones')
  f.push(`| | ${CARACTERISTICAS.map((c) => ABREV[c]).join(' | ')} |`)
  f.push(`|---|${CARACTERISTICAS.map(() => ':-:').join('|')}|`)
  f.push(`| Puntuación | ${CARACTERISTICAS.map((c) => `${h.car[c].valor} (${conSigno(h.car[c].mod)})`).join(' | ')} |`)
  f.push(`| Salvación | ${CARACTERISTICAS.map((c) => `${conSigno(h.car[c].salvacion)}${h.car[c].competenteSalv ? ' ●' : ''}`).join(' | ')} |`)

  f.push('', '### Habilidades y sentidos')
  const habs = h.habilidades.filter((s) => s.competente).map((s) => `${s.nombre} ${conSigno(s.bono)}${s.pericia ? ' (Expertise)' : ''}`)
  f.push(`- Competente: ${habs.join(', ') || '—'}`)
  f.push(`- Percepción pasiva ${h.percepcionPasiva}${h.sentidos.length ? ` · ${h.sentidos.map((s) => `${s.nombre} ${s.valor} ft`).join(', ')}` : ''}`)
  if (h.resistencias.length) f.push(`- Resistencias: ${h.resistencias.join(', ')}`)
  if (h.inmunidades.length || h.inmunidadesCondicion.length) f.push(`- Inmunidades: ${[...h.inmunidades, ...h.inmunidadesCondicion].join(', ')}`)

  f.push('', '### Competencias e idiomas')
  f.push(`- Armas: ${h.competencias.armas.join(', ') || '—'}`)
  f.push(`- Armaduras: ${h.competencias.armaduras.join(', ') || '—'}`)
  f.push(`- Herramientas: ${h.competencias.herramientas.join(', ') || '—'}`)
  f.push(`- Idiomas: ${h.competencias.idiomas.join(', ') || '—'}`)

  if (h.ataques.length) {
    f.push('', '### Ataques')
    for (const a of h.ataques) f.push(`- ${a.nombre}: ${conSigno(a.bonoAtaque)} · ${a.dano} ${a.tipoDano}${a.versatil ? ` (${a.versatil} a dos manos)` : ''} · ${a.alcance ?? ''}${a.maestria ? ` · Mastery: ${a.maestria}` : ''}`)
  }

  // Marca de aspecto: cada dote de marca con sus partes
  const marcas = r.dotes.filter((x) => x._marca)
  if (marcas.length) {
    f.push('', '### Marca de aspecto')
    for (const m of marcas) {
      const info = m._marca as { tipo: string; invertida?: boolean }
      f.push(`- **${m._nombre}** · ${info.tipo === 'plena' ? 'marca plena' : 'marca manifiesta'}${info.invertida ? ' invertida' : ''}`)
      for (const e of (m.entries as Crudo[]) ?? []) {
        if (typeof e !== 'object' || !e) continue
        if (e.name) f.push(`  - **${e.name}:** ${textoPlano(e.entries)}`)
        else if (e.type === 'table') f.push(`  - ${e.caption ?? 'Conjuros'}: ${(e.rows as unknown[][]).map((fila) => `${textoPlano([fila[0]])}: ${textoPlano([fila[1]])}`).join(' · ')}`)
      }
    }
  }

  // Rasgos por origen, con los usos de los que tienen recurso
  const usos = (nombre: string) => {
    const rec = h.recursos.find((x) => x.rasgo === nombre || x.nombre === nombre)
    return rec ? ` (${rec.max}/${RECARGA[rec.recarga]}${rec.dado ? `, ${rec.dado}` : ''})` : ''
  }
  f.push('', '### Rasgos')
  const porOrigen = new Map<string, string[]>()
  for (const x of h.rasgos) {
    // Las dotes van en su propia línea; el rasgo del trasfondo con su mismo nombre y «Wizard Subclass» no aportan nada
    if (x.tipo === 'marca' || x.tipo === 'dote' || marcas.some((m) => m._nombre === x.nombre)) continue
    if (/ Subclass$/.test(x.nombre) || (x.tipo === 'trasfondo' && x.nombre === trasfondo?._nombre)) continue
    const deClase = x.tipo === 'clase' || x.tipo === 'subclase'
    // «Mago 3 (Danzante del filo)» → «Mago (Danzante del filo)»: el nivel va en cada rasgo
    const k = deClase ? x.origen.replace(/ \d+( \(|$)/, '$1') : x.origen
    if (!porOrigen.has(k)) porOrigen.set(k, [])
    porOrigen.get(k)!.push(`${deClase ? `${x.nivel}: ` : ''}${x.nombre}${usos(x.nombre)}`)
  }
  for (const [origen, rs] of porOrigen) f.push(`- **${origen}:** ${[...new Set(rs)].join(', ')}`)
  const dotes = r.dotes.filter((x) => !x._marca).map((x) => `${x._nombre}${usos(x._nombre)}`)
  if (dotes.length) f.push(`- **Dotes:** ${dotes.join(', ')}`)
  if (r.opcionales.length) f.push(`- **Opciones de clase:** ${r.opcionales.map((x) => `${x._nombre ?? x.name}${usos(x._nombre ?? x.name)}`).join(', ')}`)
  const sinRasgo = h.recursos.filter((x) => !h.rasgos.some((y) => y.nombre === x.rasgo || y.nombre === x.nombre) && !x.id.startsWith('conj:'))
  if (sinRasgo.length) f.push(`- **Otros usos:** ${sinRasgo.map((x) => `${x.nombre} ${x.max}/${RECARGA[x.recarga]}`).join(', ')}`)

  // Conjuros
  if (h.conjuros.length) {
    f.push('', '### Conjuros')
    for (const l of h.lanzamiento) f.push(`- ${l.nombre} (${ABREV[l.car as Caracteristica]}): DC ${l.cd} · ataque ${conSigno(l.ataque)}`)
    const espacios = h.espacios.map((n, i) => `nivel ${i + 1}: ${n}`)
    if (h.pacto) espacios.push(`pacto: ${h.pacto.n} de nivel ${h.pacto.nivel}`)
    if (espacios.length) f.push(`- Espacios: ${espacios.join(' · ')}`)
    const niveles = [...new Set(h.conjuros.map((c) => c.conjuro.level))].sort((a, b) => a - b)
    for (const n of niveles) {
      const cs = h.conjuros
        .filter((c) => c.conjuro.level === n)
        .map((c) => {
          const como = c.usos === 'voluntad' ? 'a voluntad' : c.usos ? `${c.usos}/${RECARGA[c.recarga ?? 'largo']}` : c.siempre && n > 0 ? 'siempre' : n > 0 && !c.preparado ? 'en el libro' : ''
          return `*${c.conjuro.name}*${como ? ` (${como})` : ''}`
        })
      f.push(`- ${NIVEL_CONJURO(n)}: ${cs.join(', ')}`)
    }
  }

  // Equipo y dinero
  f.push('', '### Equipo')
  for (const i of p.inventario) {
    const estado = [i.equipado && 'equipado', i.sintonizado && 'sintonizado'].filter(Boolean).join(', ')
    f.push(`- ${i.cantidad > 1 ? `${i.cantidad} × ` : ''}${i.origen === 'campaña' ? `[[${i.nombre}]]` : i.nombre}${estado ? ` (${estado})` : ''}`)
  }
  f.push(`- Dinero: ${dineroSetting(p.monedas)}`)

  const relaciones = texto(det.aliados).split('\n').map((x) => x.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  return `${yaml}
# ${p.nombre}

## Concepto
${concepto}

## Trasfondo
${historia}

## Ganchos y objetivos
-

## Relaciones
${lista(relaciones)}

## Objetos destacados
${lista(destacados)}

## Ficha
${f.join('\n')}
${notasJugador.length ? `\n## Notas del jugador\n${lista(notasJugador)}\n` : ''}
## Notas del DM
-
`
}

export function exportarObsidian(p: Personaje, h: Hoja, d: Datos, catalogo: ObjetoCampaña[] = []) {
  descargar(`${limpiarNombre(p.nombre)}.md`, notaObsidian(p, h, d, catalogo))
}

export function exportarJSON(p: Personaje) {
  descargar(`${limpiarNombre(p.nombre)}.json`, JSON.stringify(p, null, 2), 'application/json')
}
