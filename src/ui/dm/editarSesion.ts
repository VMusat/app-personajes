// Cambios sobre el texto de una nota de sesión, línea a línea, sin tocar el resto del formato.
// Cada operación devuelve el texto nuevo y cómo se movieron las líneas, para conservar lo tachado.

/** Trozo editable de la nota: líneas n..fin (incluidas); el texto editable empieza en la columna d de la línea n. */
export interface Ref {
  n: number
  fin: number
  d: number
}

export interface Cambio {
  texto: string
  /** Línea antigua → línea nueva (null si se borró). */
  mapa: (n: number) => number | null
}

const partir = (texto: string) => {
  const nl = texto.includes('\r\n') ? '\r\n' : '\n'
  return { lineas: texto.split(/\r?\n/), nl }
}

/** Sustituye el texto editable de un trozo (los prefijos «## », «- [ ] », «> » se conservan). */
export function reemplazar(texto: string, ref: Ref, nuevo: string): Cambio {
  const { lineas, nl } = partir(texto)
  const base = lineas[ref.n] ?? ''
  let prefijo = base.slice(0, ref.d)
  if (nuevo && prefijo && !/\s$/.test(prefijo)) prefijo += ' '
  const quitadas = Math.max(0, ref.fin - ref.n)
  lineas.splice(ref.n, quitadas + 1, prefijo + nuevo.replace(/\s*\n\s*/g, ' '))
  return {
    texto: lineas.join(nl),
    mapa: (n) => (n <= ref.n ? n : n <= ref.fin ? null : n - quitadas),
  }
}

/** Línea vacía, también dentro de un callout («>»). */
export const lineaVacia = (l: string | undefined) => l !== undefined && !l.replace(/^[>\s]*/, '')

/**
 * Inserta líneas después de la línea `despues` (-1: al principio). Con `vacia` (la línea en blanco que toca: «» o «>»
 * dentro de un callout) separa lo insertado de lo de alrededor para que no se pegue; con null no separa.
 */
export function insertar(texto: string, despues: number, nuevas: string[], vacia: string | null = ''): Cambio & { primera: number } {
  const { lineas, nl } = partir(texto)
  const antes = lineas[despues]
  const luego = lineas[despues + 1]
  const bloque = [...nuevas]
  const separarAntes = vacia !== null && despues >= 0 && antes !== undefined && !lineaVacia(antes)
  if (separarAntes) bloque.unshift(vacia!)
  if (vacia !== null && luego !== undefined && !lineaVacia(luego)) bloque.push(vacia)
  lineas.splice(despues + 1, 0, ...bloque)
  const k = bloque.length
  return { texto: lineas.join(nl), mapa: (n) => (n <= despues ? n : n + k), primera: despues + 1 + (separarAntes ? 1 : 0) }
}

/** Borra las líneas n..fin. Si quedan dos líneas en blanco seguidas, deja una. */
export function borrar(texto: string, n: number, fin: number): Cambio {
  const { lineas, nl } = partir(texto)
  let k = fin - n + 1
  lineas.splice(n, k)
  if (n > 0 && !lineas[n - 1]?.trim() && !lineas[n]?.trim() && lineas[n] !== undefined) {
    lineas.splice(n, 1)
    k++
  }
  return { texto: lineas.join(nl), mapa: (x) => (x < n ? x : x <= fin ? null : x - k) }
}

/** Cambia el tipo de un callout: «> [!tirada]- …» → «> [!reto]- …». */
export function cambiarTipo(texto: string, n: number, tipo: string): Cambio {
  const { lineas, nl } = partir(texto)
  lineas[n] = lineas[n].replace(/\[![\w-]+\]/, `[!${tipo}]`)
  return { texto: lineas.join(nl), mapa: (x) => x }
}

/** Escribe una fila de tabla con sus celdas; las barras de los enlaces se escapan («[[a\|b]]»). */
export function escribirFila(texto: string, fila: { n: number; d: number }, celdas: string[]): Cambio {
  const { lineas, nl } = partir(texto)
  const escapar = (c: string) => c.replace(/\[\[([^\]|\\]+)\|([^\]]+)\]\]/g, '[[$1\\|$2]]').replace(/\s*\n\s*/g, ' ')
  lineas[fila.n] = lineas[fila.n].slice(0, fila.d) + '| ' + celdas.map(escapar).join(' | ') + ' |'
  return { texto: lineas.join(nl), mapa: (x) => x }
}

/** Traslada las tareas tachadas (índices por orden de aparición) al texto nuevo, siguiendo las líneas. */
export function trasladarTachadas(lineasAntes: number[], lineasDespues: number[], tachadas: number[], mapa: Cambio['mapa']): number[] {
  const out: number[] = []
  for (const t of tachadas) {
    const linea = lineasAntes[t]
    if (linea === undefined) continue
    const nueva = mapa(linea)
    if (nueva === null) continue
    const i = lineasDespues.indexOf(nueva)
    if (i >= 0) out.push(i)
  }
  return out
}

// ── Texto con formato ⇄ HTML, para editar en el sitio sin ver la sintaxis

const escaparHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Markdown en línea → HTML editable: negrita, cursiva, código y enlaces de Obsidian (que se conservan). */
export function aHtml(md: string): string {
  const partes = md.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g)
  return partes
    .map((p) => {
      let m: RegExpMatchArray | null
      if ((m = p.match(/^\[\[([^\]|\\]+)(?:\\?\|([^\]]+))?\]\]$/))) {
        const destino = m[1]
        const visible = m[2] ?? m[1]
        return `<span class="wl" data-wl="${escaparHtml(destino).replace(/"/g, '&quot;')}">${escaparHtml(visible)}</span>`
      }
      if (/^\*\*.+\*\*$/.test(p)) return `<b>${aHtml(p.slice(2, -2))}</b>`
      if (/^\*[^*].*\*$/.test(p)) return `<i>${aHtml(p.slice(1, -1))}</i>`
      if (/^`.+`$/.test(p)) return `<code>${escaparHtml(p.slice(1, -1))}</code>`
      return escaparHtml(p)
    })
    .join('')
}

/** HTML de un elemento editable → markdown en línea. */
export function aMarkdown(nodo: Node): string {
  let out = ''
  nodo.childNodes.forEach((h) => {
    if (h.nodeType === 3) {
      out += (h.textContent ?? '').replace(/\xa0/g, ' ')
      return
    }
    if (h.nodeType !== 1) return
    const el = h as HTMLElement
    const tag = el.tagName.toLowerCase()
    const dentro = aMarkdown(el)
    if (el.dataset.wl !== undefined) {
      const visible = el.textContent ?? ''
      out += visible === el.dataset.wl ? `[[${visible}]]` : visible ? `[[${el.dataset.wl}|${visible}]]` : ''
    } else if (tag === 'b' || tag === 'strong' || (tag === 'span' && /bold|[6-9]00/.test(el.style.fontWeight))) out += dentro.trim() ? envolver(dentro, '**') : dentro
    else if (tag === 'i' || tag === 'em' || (tag === 'span' && el.style.fontStyle === 'italic')) out += dentro.trim() ? envolver(dentro, '*') : dentro
    else if (tag === 'code') out += `\`${el.textContent ?? ''}\``
    else if (tag === 'br') out += ' '
    else if (tag === 'div' || tag === 'p') out += (out && !out.endsWith(' ') ? ' ' : '') + dentro
    else out += dentro
  })
  return out
}

/** Envuelve conservando los espacios de los extremos fuera de la marca («**hola** » y no «**hola **»). */
function envolver(s: string, marca: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!
  return `${m[1]}${marca}${m[2]}${marca}${m[3]}`
}
