// Lector de las notas de sesión de la bóveda (carpeta Sesiones/) para la Pantalla del DM.
// Entiende: títulos, párrafos, listas anidadas con tareas «- [ ]» (que se tachan), tablas, separadores
// y callouts plegables de Obsidian: [!narracion], [!dialogo], [!tirada], [!reto], [!salvacion], [!dm], [!info].
import { Fragment, useState, type ReactNode } from 'react'
import { idDe } from '../guiaMarkdown'

export interface ItemLista {
  texto: string
  /** Índice de tarea dentro de la nota (para guardar qué está tachado), si es «- [ ]». */
  tarea?: number
  hechaEnNota?: boolean
  hijos: ItemLista[]
}

export type BloqueSesion =
  | { tipo: 'titulo'; nivel: number; texto: string; id: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; items: ItemLista[] }
  | { tipo: 'tabla'; cabecera: string[]; filas: string[][] }
  | { tipo: 'callout'; clase: string; plegado: boolean | null; titulo: string; hijos: BloqueSesion[] }
  | { tipo: 'separador' }

const RE = {
  titulo: /^(#{1,6})\s+(.*)$/,
  callout: /^\[!([\w-]+)\]([+-]?)\s*(.*)$/,
  lista: /^(\s*)([-*]|\d+\.)\s+(.*)$/,
  tarea: /^\[( |x|X)\]\s*(.*)$/,
  separadorTabla: /^\|?\s*:?-{2,}/,
  regla: /^-{3,}\s*$/,
  comentario: /^<!--.*-->$/,
}

/** Lee una nota de sesión. Las tareas se numeran en orden de aparición. */
export function leerSesion(texto: string): BloqueSesion[] {
  const limpio = texto.replace(/\r/g, '').replace(/^---\n[\s\S]*?\n---\n/, '').replace(/%%[\s\S]*?%%/g, '')
  const contador = { n: 0 }
  return bloques(limpio.split('\n'), contador)
}

function bloques(lineas: string[], contador: { n: number }): BloqueSesion[] {
  const out: BloqueSesion[] = []
  let i = 0
  const empiezaBloque = (l: string) => !l.trim() || RE.titulo.test(l) || l.startsWith('>') || RE.lista.test(l) || l.startsWith('|') || RE.regla.test(l)
  while (i < lineas.length) {
    const l = lineas[i]
    let m: RegExpMatchArray | null
    if (!l.trim() || RE.comentario.test(l.trim())) {
      i++
    } else if ((m = l.match(RE.titulo))) {
      out.push({ tipo: 'titulo', nivel: m[1].length, texto: m[2].trim(), id: idDe(m[2]) })
      i++
    } else if (l.startsWith('>')) {
      const cuerpo: string[] = []
      while (i < lineas.length && lineas[i].startsWith('>')) cuerpo.push(lineas[i++].replace(/^>\s?/, ''))
      const c = cuerpo[0].match(RE.callout)
      if (c) out.push({ tipo: 'callout', clase: c[1].toLowerCase(), plegado: c[2] === '-' ? true : c[2] === '+' ? false : null, titulo: c[3].trim(), hijos: bloques(cuerpo.slice(1), contador) })
      else out.push({ tipo: 'callout', clase: 'cita', plegado: null, titulo: '', hijos: bloques(cuerpo, contador) })
    } else if (l.startsWith('|') && RE.separadorTabla.test(lineas[i + 1] ?? '')) {
      // Las barras escapadas «\|» de los enlaces no parten la celda
      const celdas = (s: string) => s.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((x) => x.trim().replace(/\\\|/g, '|'))
      const cabecera = celdas(l)
      i += 2
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].startsWith('|')) filas.push(celdas(lineas[i++]))
      out.push({ tipo: 'tabla', cabecera, filas })
    } else if ((m = l.match(RE.lista))) {
      const ordenada = /\d/.test(m[2])
      const filas: { sangria: number; texto: string }[] = []
      while (i < lineas.length && lineas[i].trim()) {
        const li = lineas[i].match(RE.lista)
        if (li) filas.push({ sangria: li[1].replace(/\t/g, '  ').length, texto: li[3] })
        else if (filas.length) filas[filas.length - 1].texto += ' ' + lineas[i].trim()
        i++
      }
      out.push({ tipo: 'lista', ordenada, items: arbol(filas, contador) })
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

/** Convierte filas con sangría en un árbol de elementos. */
function arbol(filas: { sangria: number; texto: string }[], contador: { n: number }): ItemLista[] {
  const raiz: ItemLista[] = []
  const pila: { sangria: number; hijos: ItemLista[] }[] = [{ sangria: -1, hijos: raiz }]
  for (const f of filas) {
    const t = f.texto.match(RE.tarea)
    const item: ItemLista = t ? { texto: t[2], tarea: contador.n++, hechaEnNota: t[1] !== ' ', hijos: [] } : { texto: f.texto, hijos: [] }
    while (pila.length > 1 && pila[pila.length - 1].sangria >= f.sangria) pila.pop()
    pila[pila.length - 1].hijos.push(item)
    pila.push({ sangria: f.sangria, hijos: item.hijos })
  }
  return raiz
}

/** Negrita, cursiva, código, enlaces de Obsidian (quedan en texto) y el dado 🎲 resaltado. */
export function enLineaSesion(texto: string): ReactNode {
  const t = texto.replace(/\[\[([^\]|\\]+)\\?\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  const piezas = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|🎲)/g)
  return piezas.map((p, i) => {
    if (/^\*\*.+\*\*$/.test(p)) return <b key={i}>{enLineaSesion(p.slice(2, -2))}</b>
    if (/^\*[^*]+\*$/.test(p)) return <i key={i}>{enLineaSesion(p.slice(1, -1))}</i>
    if (/^`[^`]+`$/.test(p)) return <code key={i}>{p.slice(1, -1)}</code>
    if (p === '🎲') return <span key={i} className="sesion-dado" title="Esta línea dispara una tirada">🎲</span>
    return <Fragment key={i}>{p}</Fragment>
  })
}

const ESTILO: Record<string, { icono: string; nombre: string }> = {
  narracion: { icono: '📜', nombre: 'Narración' },
  dialogo: { icono: '💬', nombre: 'Diálogo' },
  tirada: { icono: '🎲', nombre: 'Tirada' },
  reto: { icono: '⚔', nombre: 'Reto' },
  salvacion: { icono: '🛡', nombre: 'Salvación' },
  dm: { icono: '🔒', nombre: 'DM' },
  info: { icono: 'ℹ', nombre: 'Info' },
}

export interface PropsNota {
  tachadas: number[]
  alTachar: (n: number, hecha: boolean) => void
  /** Filtro de tipos de desplegable que se ven («todos» si está vacío). */
  ocultos: string[]
}

export function PintarSesion({ bloques: bs, ...props }: { bloques: BloqueSesion[] } & PropsNota) {
  return <>{bs.map((b, i) => <PintarBloque key={i} b={b} {...props} />)}</>
}

function PintarBloque({ b, ...props }: { b: BloqueSesion } & PropsNota) {
  switch (b.tipo) {
    case 'titulo': {
      const Etiqueta = (`h${Math.min(b.nivel + 1, 5)}` as 'h3')
      return <Etiqueta id={b.id} className="sesion-titulo">{enLineaSesion(b.texto)}</Etiqueta>
    }
    case 'parrafo':
      return <p>{enLineaSesion(b.texto)}</p>
    case 'separador':
      return <hr />
    case 'lista':
      return <Lista items={b.items} ordenada={b.ordenada} {...props} />
    case 'tabla':
      return (
        <div className="guia-tabla-scroll">
          <table className="guia-tabla">
            <thead><tr>{b.cabecera.map((c, j) => <th key={j}>{enLineaSesion(c)}</th>)}</tr></thead>
            <tbody>{b.filas.map((f, j) => <tr key={j}>{f.map((c, k) => <td key={k}>{enLineaSesion(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    case 'callout':
      if (props.ocultos.includes(b.clase)) return null
      return <Desplegable b={b} {...props} />
  }
}

function Desplegable({ b, ...props }: { b: Extract<BloqueSesion, { tipo: 'callout' }> } & PropsNota) {
  const [abierto, setAbierto] = useState(b.plegado !== true)
  const e = ESTILO[b.clase] ?? { icono: '', nombre: b.clase }
  const cuerpo = <PintarSesion bloques={b.hijos} {...props} />
  if (b.plegado === null)
    return (
      <aside className={`sesion-callout c-${b.clase}`}>
        {b.clase !== 'cita' && <div className="sesion-callout-titulo">{e.icono} {enLineaSesion(b.titulo || e.nombre)}</div>}
        {cuerpo}
      </aside>
    )
  return (
    <details className={`sesion-callout c-${b.clase}`} open={abierto} onToggle={(ev) => setAbierto((ev.target as HTMLDetailsElement).open)}>
      <summary className="sesion-callout-titulo">
        <span className="sesion-tipo">{e.icono} {e.nombre}</span> {enLineaSesion(b.titulo)}
      </summary>
      {abierto && cuerpo}
    </details>
  )
}

function Lista({ items, ordenada, ...props }: { items: ItemLista[]; ordenada: boolean } & PropsNota) {
  const Etiqueta = ordenada ? 'ol' : 'ul'
  return (
    <Etiqueta className="sesion-lista">
      {items.map((it, i) => {
        const hecha = it.tarea !== undefined && (props.tachadas.includes(it.tarea) || !!it.hechaEnNota)
        return (
          <li key={i} className={it.tarea !== undefined ? `sesion-tarea ${hecha ? 'hecha' : ''}` : undefined}>
            {it.tarea !== undefined ? (
              <label>
                <input type="checkbox" checked={hecha} onChange={(e) => props.alTachar(it.tarea!, e.target.checked)} />
                <span>{enLineaSesion(it.texto)}</span>
              </label>
            ) : (
              enLineaSesion(it.texto)
            )}
            {it.hijos.length > 0 && <Lista items={it.hijos} ordenada={false} {...props} />}
          </li>
        )
      })}
    </Etiqueta>
  )
}
