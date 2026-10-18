// Lector del Markdown de Obsidian que usa la Guía para aventureros (nota de la bóveda copiada en src/setting/guia.md).
// Entiende solo lo que usa la nota: títulos, párrafos, negrita y cursiva, listas, tablas, citas, imágenes ![[...]],
// comentarios %%...%% y callouts [!rumor], [!consejo], [!ficha], [!distrito|color|símbolo] y [!pie].
import { Fragment, type ReactNode } from 'react'

export type Bloque =
  | { tipo: 'titulo'; nivel: number; texto: string; id: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; items: string[] }
  | { tipo: 'tabla'; cabecera: string[]; filas: string[][] }
  | { tipo: 'cita'; texto: string }
  | { tipo: 'imagen'; archivo: string; pie?: string }
  | { tipo: 'callout'; clase: string; meta: string[]; titulo: string; hijos: Bloque[] }
  | { tipo: 'separador' }

export function idDe(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const RE = {
  titulo: /^(#{1,6})\s+(.*)$/,
  imagen: /^!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/,
  pie: /^[*_](.+)[*_]\s*$/,
  callout: /^\[!([\w-]+)((?:\|[^\]]*)?)\]\s*(.*)$/,
  lista: /^\s*([-*]|\d+\.)\s+(.*)$/,
  separadorTabla: /^\|?\s*:?-{2,}/,
  regla: /^-{3,}\s*$/,
}

/** Divide el texto en bloques. */
export function leerBloques(texto: string): Bloque[] {
  // Fuera el frontmatter y los comentarios de Obsidian
  const limpio = texto.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/%%[\s\S]*?%%/g, '')
  return bloques(limpio.replace(/\r/g, '').split('\n'))
}

function bloques(lineas: string[]): Bloque[] {
  const out: Bloque[] = []
  let i = 0
  const empiezaBloque = (l: string) =>
    !l.trim() || RE.titulo.test(l) || RE.imagen.test(l) || l.startsWith('>') || RE.lista.test(l) || l.startsWith('|') || RE.regla.test(l)
  while (i < lineas.length) {
    const l = lineas[i]
    if (!l.trim()) {
      i++
      continue
    }
    let m: RegExpMatchArray | null
    if ((m = l.match(RE.titulo))) {
      out.push({ tipo: 'titulo', nivel: m[1].length, texto: m[2].trim(), id: idDe(m[2]) })
      i++
    } else if ((m = l.match(RE.imagen))) {
      const sig = lineas[i + 1]?.match(RE.pie)
      out.push({ tipo: 'imagen', archivo: m[1].trim(), pie: sig?.[1] })
      i += sig ? 2 : 1
    } else if (l.startsWith('>')) {
      const cuerpo: string[] = []
      while (i < lineas.length && lineas[i].startsWith('>')) cuerpo.push(lineas[i++].replace(/^>\s?/, ''))
      const c = cuerpo[0].match(RE.callout)
      if (c) {
        out.push({
          tipo: 'callout',
          clase: c[1].toLowerCase(),
          meta: c[2] ? c[2].slice(1).split('|').map((s) => s.trim()) : [],
          titulo: c[3].trim(),
          hijos: bloques(cuerpo.slice(1)),
        })
      } else out.push({ tipo: 'cita', texto: cuerpo.join(' ') })
    } else if (l.startsWith('|') && RE.separadorTabla.test(lineas[i + 1] ?? '')) {
      const celdas = (s: string) => s.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim())
      const cabecera = celdas(l)
      i += 2
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].startsWith('|')) filas.push(celdas(lineas[i++]))
      out.push({ tipo: 'tabla', cabecera, filas })
    } else if ((m = l.match(RE.lista))) {
      const ordenada = /\d/.test(m[1])
      const items: string[] = []
      while (i < lineas.length && lineas[i].trim()) {
        const li = lineas[i].match(RE.lista)
        if (li) items.push(li[2])
        else items[items.length - 1] += ' ' + lineas[i].trim()
        i++
      }
      out.push({ tipo: 'lista', ordenada, items })
    } else if (RE.regla.test(l)) {
      out.push({ tipo: 'separador' })
      i++
    } else {
      const partes = [l.trim()]
      i++
      while (i < lineas.length && !empiezaBloque(lineas[i])) partes.push(lineas[i++].trim())
      out.push({ tipo: 'parrafo', texto: partes.join(' ') })
    }
  }
  return out
}

/** Negrita, cursiva y enlaces de Obsidian (que se quedan en texto). */
export function enLinea(texto: string): ReactNode {
  const t = texto.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  const piezas = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g)
  return piezas.map((p, i) => {
    if (/^\*\*.+\*\*$/.test(p)) return <b key={i}>{enLinea(p.slice(2, -2))}</b>
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>
    return <Fragment key={i}>{p}</Fragment>
  })
}
