// Lector de las notas de sesión de la bóveda (carpeta Sesiones/) para la Pantalla del DM.
// Entiende: títulos, párrafos, listas anidadas con tareas «- [ ]» (que se tachan), tablas, separadores
// y callouts plegables de Obsidian: [!narracion], [!dialogo], [!tirada], [!reto], [!salvacion], [!dm], [!info].
// Cada elemento recuerda sus líneas en el texto, para editarlo en el sitio sin tocar el resto (modo edición).
import { createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { idDe } from '../guiaMarkdown'
import { aHtml, aMarkdown, type Ref } from './editarSesion'

export interface ItemLista {
  texto: string
  /** Índice de tarea dentro de la nota (para guardar qué está tachado), si es «- [ ]». */
  tarea?: number
  hechaEnNota?: boolean
  hijos: ItemLista[]
  ref: Ref
  /** Última línea del elemento con sus hijos. */
  finArbol: number
  /** Lo que va antes del texto en su línea («  - [ ] », «> - »), para crear hermanos. */
  prefijo: string
}

interface Lineas {
  n: number
  fin: number
}

export type BloqueSesion = Lineas &
  (
    | { tipo: 'titulo'; nivel: number; texto: string; id: string; ref: Ref }
    | { tipo: 'parrafo'; texto: string; ref: Ref }
    | { tipo: 'lista'; ordenada: boolean; items: ItemLista[] }
    | { tipo: 'tabla'; cabecera: string[]; filas: string[][]; lineas: { n: number; d: number }[] }
    | { tipo: 'callout'; clase: string; plegado: boolean | null; titulo: string; hijos: BloqueSesion[]; ref?: Ref; /** «> » (o «> > »): lo que va delante de cada línea de su cuerpo. */ prefijoCuerpo: string }
    | { tipo: 'separador' }
  )

const RE = {
  titulo: /^(#{1,6})\s+(.*)$/,
  callout: /^\[!([\w-]+)\]([+-]?)\s*(.*)$/,
  lista: /^(\s*)([-*]|\d+\.)\s+(.*)$/,
  tarea: /^\[( |x|X)\]\s*(.*)$/,
  separadorTabla: /^\|?\s*:?-{2,}/,
  regla: /^-{3,}\s*$/,
  comentario: /^<!--.*-->$/,
}

/** Una línea a leer: su texto (sin los «>» de fuera), su número en la nota y la columna donde empieza ese texto. */
interface L {
  t: string
  n: number
  d: number
}

interface Ctx {
  n: number
  crudas: string[]
}

/** Lee una nota de sesión. Las tareas se numeran en orden de aparición. */
export function leerSesion(texto: string): BloqueSesion[] {
  const crudas = texto.split(/\r?\n/)
  let ini = 0
  if (crudas[0]?.trim() === '---') {
    const fin = crudas.findIndex((l, i) => i > 0 && l.trim() === '---')
    if (fin > 0) ini = fin + 1
  }
  const ls: L[] = crudas.map((t, n) => ({ t: n < ini ? '' : t, n, d: 0 }))
  // Comentarios de Obsidian %% … %%
  let dentro = false
  for (const l of ls) {
    const c = (l.t.match(/%%/g) ?? []).length
    if (dentro) {
      l.t = ''
      if (c % 2) dentro = false
    } else if (c % 2) {
      l.t = ''
      dentro = true
    } else if (c) l.t = l.t.replace(/%%.*?%%/g, '')
  }
  return bloques(ls, { n: 0, crudas })
}

/** Línea de cada tarea, por orden (para trasladar lo tachado al editar). */
export function lineasDeTareas(texto: string): number[] {
  const out: number[] = []
  const rec = (bs: BloqueSesion[]) =>
    bs.forEach((b) => {
      if (b.tipo === 'callout') rec(b.hijos)
      if (b.tipo === 'lista') {
        const items = (is: ItemLista[]) => is.forEach((i) => (i.tarea !== undefined && (out[i.tarea] = i.ref.n), items(i.hijos)))
        items(b.items)
      }
    })
  rec(leerSesion(texto))
  return out
}

function bloques(lineas: L[], ctx: Ctx): BloqueSesion[] {
  const out: BloqueSesion[] = []
  let i = 0
  const empiezaBloque = (l: string) => !l.trim() || RE.titulo.test(l) || l.startsWith('>') || RE.lista.test(l) || l.startsWith('|') || RE.regla.test(l)
  while (i < lineas.length) {
    const l = lineas[i]
    let m: RegExpMatchArray | null
    if (!l.t.trim() || RE.comentario.test(l.t.trim())) {
      i++
    } else if ((m = l.t.match(RE.titulo))) {
      const ref = { n: l.n, fin: l.n, d: l.d + l.t.length - m[2].length }
      out.push({ tipo: 'titulo', nivel: m[1].length, texto: m[2].trim(), id: idDe(m[2]), ref, n: l.n, fin: l.n })
      i++
    } else if (l.t.startsWith('>')) {
      const cuerpo: L[] = []
      while (i < lineas.length && lineas[i].t.startsWith('>')) {
        const x = lineas[i++]
        const t = x.t.replace(/^>\s?/, '')
        cuerpo.push({ t, n: x.n, d: x.d + x.t.length - t.length })
      }
      const fin = cuerpo[cuerpo.length - 1].n
      const prefijoCuerpo = ctx.crudas[cuerpo[0].n].slice(0, cuerpo[0].d)
      const c = cuerpo[0].t.match(RE.callout)
      if (c) {
        const ref = { n: cuerpo[0].n, fin: cuerpo[0].n, d: cuerpo[0].d + cuerpo[0].t.length - c[3].length }
        out.push({ tipo: 'callout', clase: c[1].toLowerCase(), plegado: c[2] === '-' ? true : c[2] === '+' ? false : null, titulo: c[3].trim(), hijos: bloques(cuerpo.slice(1), ctx), ref, prefijoCuerpo, n: l.n, fin })
      } else out.push({ tipo: 'callout', clase: 'cita', plegado: null, titulo: '', hijos: bloques(cuerpo, ctx), prefijoCuerpo, n: l.n, fin })
    } else if (l.t.startsWith('|') && RE.separadorTabla.test(lineas[i + 1]?.t ?? '')) {
      // Las barras escapadas «\|» de los enlaces no parten la celda
      const celdas = (s: string) => s.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((x) => x.trim().replace(/\\\|/g, '|'))
      const cabecera = celdas(l.t)
      const filasLineas = [{ n: l.n, d: l.d }]
      i += 2
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].t.startsWith('|')) {
        filasLineas.push({ n: lineas[i].n, d: lineas[i].d })
        filas.push(celdas(lineas[i++].t))
      }
      out.push({ tipo: 'tabla', cabecera, filas, lineas: filasLineas, n: l.n, fin: lineas[i - 1].n })
    } else if ((m = l.t.match(RE.lista))) {
      const ordenada = /\d/.test(m[2])
      const filas: Fila[] = []
      while (i < lineas.length && lineas[i].t.trim()) {
        const x = lineas[i]
        const li = x.t.match(RE.lista)
        if (li) filas.push({ sangria: li[1].replace(/\t/g, '  ').length, texto: li[3], n: x.n, fin: x.n, d: x.d + x.t.length - li[3].length })
        else if (filas.length) {
          filas[filas.length - 1].texto += ' ' + x.t.trim()
          filas[filas.length - 1].fin = x.n
        }
        i++
      }
      out.push({ tipo: 'lista', ordenada, items: arbol(filas, ctx), n: filas[0].n, fin: filas[filas.length - 1].fin })
    } else if (RE.regla.test(l.t)) {
      out.push({ tipo: 'separador', n: l.n, fin: l.n })
      i++
    } else {
      const partes = [l.t.trim()]
      const primera = l
      let ultima = l
      i++
      while (i < lineas.length && !empiezaBloque(lineas[i].t)) {
        ultima = lineas[i]
        partes.push(lineas[i++].t.trim())
      }
      const ref = { n: primera.n, fin: ultima.n, d: primera.d + primera.t.length - primera.t.trimStart().length }
      out.push({ tipo: 'parrafo', texto: partes.join(' '), ref, n: primera.n, fin: ultima.n })
    }
  }
  return out
}

interface Fila {
  sangria: number
  texto: string
  n: number
  fin: number
  d: number
}

/** Convierte filas con sangría en un árbol de elementos. */
function arbol(filas: Fila[], ctx: Ctx): ItemLista[] {
  const raiz: ItemLista[] = []
  const pila: { sangria: number; item?: ItemLista; hijos: ItemLista[] }[] = [{ sangria: -1, hijos: raiz }]
  for (const f of filas) {
    const t = f.texto.match(RE.tarea)
    const d = t ? f.d + f.texto.length - t[2].length : f.d
    const prefijo = ctx.crudas[f.n].slice(0, d).replace(/\[[xX]\]/, '[ ]')
    const ref = { n: f.n, fin: f.fin, d }
    const item: ItemLista = t
      ? { texto: t[2], tarea: ctx.n++, hechaEnNota: t[1] !== ' ', hijos: [], ref, finArbol: f.fin, prefijo }
      : { texto: f.texto, hijos: [], ref, finArbol: f.fin, prefijo }
    while (pila.length > 1 && pila[pila.length - 1].sangria >= f.sangria) pila.pop()
    pila[pila.length - 1].hijos.push(item)
    for (const p of pila) if (p.item) p.item.finArbol = Math.max(p.item.finArbol, f.fin)
    pila.push({ sangria: f.sangria, item, hijos: item.hijos })
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

export const ESTILO: Record<string, { icono: string; nombre: string; titulo: string; texto: string }> = {
  narracion: { icono: '📜', nombre: 'Narración', titulo: 'Narración', texto: 'Lo que se lee en voz alta.' },
  dialogo: { icono: '💬', nombre: 'Diálogo', titulo: 'PNJ · Tema', texto: '«…»' },
  tirada: { icono: '🎲', nombre: 'Tirada', titulo: 'Perception CD 13 · Qué se busca', texto: '- **Éxito:** …' },
  reto: { icono: '⚔', nombre: 'Reto', titulo: 'Reto', texto: 'Qué hay que superar.' },
  salvacion: { icono: '🛡', nombre: 'Salvación', titulo: 'Salvación de DEX CD 13', texto: '- **Fallo:** …' },
  dm: { icono: '🔒', nombre: 'DM', titulo: 'Para el DM', texto: 'Lo que solo sabe el DM.' },
  info: { icono: 'ℹ', nombre: 'Info', titulo: 'Info', texto: '…' },
}

// ── Edición en el sitio

export interface Edicion {
  /** Sustituye el texto de un trozo (vacío en un elemento de lista o párrafo: lo borra). */
  reemplazar: (ref: Ref, md: string, borrable?: boolean) => void
  /** Inserta líneas tras la línea `despues`; `vacia` es la línea en blanco del contexto (null: sin separar). Enfoca lo insertado. */
  insertar: (despues: number, lineas: string[], vacia: string | null) => void
  /** Guarda un elemento de lista y crea otro debajo (Intro). */
  intro: (item: ItemLista, md: string) => void
  borrar: (n: number, fin: number) => void
  tipo: (n: number, tipo: string) => void
  fila: (f: { n: number; d: number }, celdas: string[]) => void
  /** Línea recién insertada que hay que enfocar. */
  enfocar?: number
}

const EdicionCtx = createContext<Edicion | null>(null)

/** Texto editable en el sitio: se ve con su formato y se guarda al salir (Intro guarda; Esc deshace). */
function Editable({ md, alGuardar, alIntro, linea, como = 'span', vacio = 'Escribe aquí…', borrarVacio = false }: {
  md: string
  alGuardar: (md: string) => void
  alIntro?: (md: string) => void
  linea?: number
  como?: 'span' | 'div'
  vacio?: string
  /** Si se deja vacío, se guarda igualmente (y quien lo recibe lo borra). */
  borrarVacio?: boolean
}) {
  const ed = useContext(EdicionCtx)
  const el = useRef<HTMLElement>(null)
  const saltar = useRef(false)
  useEffect(() => {
    if (el.current && document.activeElement !== el.current) el.current.innerHTML = aHtml(md)
  }, [md])
  useEffect(() => {
    if (ed?.enfocar === undefined || ed.enfocar !== linea || !el.current) return
    el.current.focus()
    const r = document.createRange()
    r.selectNodeContents(el.current)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(r)
  }, [ed?.enfocar, linea])
  const Etiqueta = como
  return (
    <Etiqueta
      ref={el as never}
      className="editable"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-vacio={vacio}
      onBlur={() => {
        if (saltar.current) {
          saltar.current = false
          return
        }
        const nuevo = aMarkdown(el.current!).replace(/\s+/g, ' ').trim()
        if (nuevo !== md.trim() || (borrarVacio && !nuevo)) alGuardar(nuevo)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const nuevo = aMarkdown(el.current!).replace(/\s+/g, ' ').trim()
          saltar.current = true
          if (alIntro) alIntro(nuevo)
          else if (nuevo !== md.trim()) alGuardar(nuevo)
          el.current?.blur()
        } else if (e.key === 'Escape') {
          el.current!.innerHTML = aHtml(md)
          saltar.current = true
          el.current?.blur()
        }
      }}
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '))
      }}
    />
  )
}

/** Menú para añadir una línea o una tarjeta en un punto de la nota. */
function Insertar({ despues, prefijo, dentro }: { despues: number; prefijo: string; dentro: boolean }) {
  const ed = useContext(EdicionCtx)
  const [abierto, setAbierto] = useState(false)
  if (!ed) return null
  const vacia = prefijo ? prefijo.trimEnd() : ''
  const poner = (lineas: string[]) => {
    ed.insertar(despues, lineas.map((l) => prefijo + l), vacia)
    setAbierto(false)
  }
  return (
    <div className={`sesion-insertar ${abierto ? 'abierto' : ''}`}>
      {!abierto ? (
        <button className="sesion-mas" onClick={() => setAbierto(true)} title="Añadir aquí">＋</button>
      ) : (
        <div className="sesion-menu">
          <button className="chip" onClick={() => poner(['- [ ] Nueva línea'])}>☐ Línea de escena</button>
          {dentro && <button className="chip" onClick={() => poner(['- Nuevo punto'])}>• Punto</button>}
          <button className="chip" onClick={() => poner(['Nuevo texto'])}>¶ Texto</button>
          {!dentro &&
            Object.entries(ESTILO)
              .filter(([k]) => k !== 'info')
              .map(([k, e]) => (
                <button key={k} className={`chip c-${k}`} onClick={() => poner([`> [!${k}]- ${e.titulo}`, `> ${e.texto}`])}>{e.icono} {e.nombre}</button>
              ))}
          <button className="boton-icono" onClick={() => setAbierto(false)} aria-label="Cerrar">✕</button>
        </div>
      )}
    </div>
  )
}

export interface PropsNota {
  tachadas: number[]
  alTachar: (n: number, hecha: boolean) => void
  /** Filtro de tipos de desplegable que se ven («todos» si está vacío). */
  ocultos: string[]
}

export function PintarSesion({ bloques: bs, edicion, ...props }: { bloques: BloqueSesion[]; edicion?: Edicion } & PropsNota) {
  return (
    <EdicionCtx.Provider value={edicion ?? null}>
      <Bloques bs={bs} prefijo="" dentro={false} {...props} />
    </EdicionCtx.Provider>
  )
}

function Bloques({ bs, prefijo, dentro, despuesDe, ...props }: { bs: BloqueSesion[]; prefijo: string; dentro: boolean; despuesDe?: number } & PropsNota) {
  const ed = useContext(EdicionCtx)
  return (
    <>
      {ed && despuesDe !== undefined && <Insertar despues={despuesDe} prefijo={prefijo} dentro={dentro} />}
      {bs.map((b, i) => (
        <Fragment key={i}>
          <PintarBloque b={b} {...props} />
          {ed && <Insertar despues={b.fin} prefijo={prefijo} dentro={dentro} />}
        </Fragment>
      ))}
    </>
  )
}

function PintarBloque({ b, ...props }: { b: BloqueSesion } & PropsNota) {
  const ed = useContext(EdicionCtx)
  switch (b.tipo) {
    case 'titulo': {
      const Etiqueta = (`h${Math.min(b.nivel + 1, 5)}` as 'h3')
      return (
        <Etiqueta id={b.id} className="sesion-titulo">
          {ed ? <Editable md={b.texto} linea={b.ref.n} alGuardar={(md) => ed.reemplazar(b.ref, md)} /> : enLineaSesion(b.texto)}
        </Etiqueta>
      )
    }
    case 'parrafo':
      return ed ? (
        <div className="sesion-editable-fila">
          <Editable como="div" md={b.texto} linea={b.ref.n} borrarVacio alGuardar={(md) => ed.reemplazar(b.ref, md, true)} />
          <button className="boton-icono sesion-borrar" title="Borrar" onClick={() => ed.borrar(b.n, b.fin)}>🗑</button>
        </div>
      ) : (
        <p>{enLineaSesion(b.texto)}</p>
      )
    case 'separador':
      return <hr />
    case 'lista':
      return <Lista items={b.items} ordenada={b.ordenada} {...props} />
    case 'tabla':
      return (
        <div className="guia-tabla-scroll">
          <table className="guia-tabla">
            <thead>
              <tr>{b.cabecera.map((c, j) => <th key={j}>{ed ? <Editable md={c} alGuardar={(md) => ed.fila(b.lineas[0], b.cabecera.map((x, k) => (k === j ? md : x)))} /> : enLineaSesion(c)}</th>)}</tr>
            </thead>
            <tbody>
              {b.filas.map((f, j) => (
                <tr key={j}>
                  {f.map((c, k) => (
                    <td key={k}>{ed ? <Editable md={c} alGuardar={(md) => ed.fila(b.lineas[j + 1], f.map((x, q) => (q === k ? md : x)))} /> : enLineaSesion(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'callout':
      if (props.ocultos.includes(b.clase)) return null
      return ed ? <CalloutEditable b={b} {...props} /> : <Desplegable b={b} {...props} />
  }
}

function CalloutEditable({ b, ...props }: { b: Extract<BloqueSesion, { tipo: 'callout' }> } & PropsNota) {
  const ed = useContext(EdicionCtx)!
  const e = ESTILO[b.clase] ?? { icono: '', nombre: b.clase }
  const prefijo = b.prefijoCuerpo
  return (
    <div className={`sesion-callout c-${b.clase} editando`}>
      {b.ref && (
        <div className="sesion-callout-titulo fila">
          <select className="sesion-tipo-select" value={b.clase} onChange={(ev) => ed.tipo(b.ref!.n, ev.target.value)} aria-label="Tipo de tarjeta">
            {Object.entries(ESTILO).map(([k, x]) => <option key={k} value={k}>{x.icono} {x.nombre}</option>)}
            {!ESTILO[b.clase] && <option value={b.clase}>{e.nombre}</option>}
          </select>
          <Editable md={b.titulo} linea={b.ref.n} alGuardar={(md) => ed.reemplazar(b.ref!, md)} vacio="Título" />
          <button className="boton-icono sesion-borrar" title="Borrar la tarjeta" onClick={() => ed.borrar(b.n, b.fin)}>🗑</button>
        </div>
      )}
      <Bloques bs={b.hijos} prefijo={prefijo} dentro despuesDe={b.hijos.length ? undefined : b.fin} {...props} />
    </div>
  )
}

function Desplegable({ b, ...props }: { b: Extract<BloqueSesion, { tipo: 'callout' }> } & PropsNota) {
  const [abierto, setAbierto] = useState(b.plegado !== true)
  const e = ESTILO[b.clase] ?? { icono: '', nombre: b.clase }
  const cuerpo = <Bloques bs={b.hijos} prefijo="" dentro {...props} />
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
  const ed = useContext(EdicionCtx)
  const Etiqueta = ordenada ? 'ol' : 'ul'
  return (
    <Etiqueta className="sesion-lista">
      {items.map((it, i) => {
        const hecha = it.tarea !== undefined && (props.tachadas.includes(it.tarea) || !!it.hechaEnNota)
        const casilla = it.tarea !== undefined && <input type="checkbox" checked={hecha} onChange={(e) => props.alTachar(it.tarea!, e.target.checked)} />
        return (
          <li key={i} className={it.tarea !== undefined ? `sesion-tarea ${hecha ? 'hecha' : ''}` : undefined}>
            {ed ? (
              <div className="sesion-editable-fila">
                {casilla}
                <Editable md={it.texto} linea={it.ref.n} borrarVacio alGuardar={(md) => ed.reemplazar(it.ref, md, true)} alIntro={(md) => (md ? ed.intro(it, md) : ed.reemplazar(it.ref, '', true))} />
                <button className="boton-icono sesion-borrar" title="Borrar (con lo que tenga debajo)" onClick={() => ed.borrar(it.ref.n, it.finArbol)}>🗑</button>
              </div>
            ) : it.tarea !== undefined ? (
              <label>
                {casilla}
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
