// Pantalla del DM: la nota de sesión a un lado y la mesa al otro (PJs en vivo, iniciativa y escenario de criaturas).
// El escenario se guarda en el almacén (solo DM); los PJs, sus aliados y sus formas llegan en vivo de sus hojas.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { derivar, type Hoja } from '../../motor/derivar'
import type { Personaje } from '../../motor/personaje'
import { nuevoId } from '../../motor/personaje'
import { MODO_INICIATIVA, TIPO_ALIADO } from '../../motor/compania'
import { pantallaVacia, tituloNota, type CriaturaEscenario, type NotaSesion, type PantallaDM as Pantalla } from '../../almacen/pantalla'
import { claveEntrada, criaturaVacia, entradas, nombreSinergia, recarga, sinergiaActiva, usosPorDia } from '../../almacen/criaturas'
import { formulaValida, resolverTirada, tirarDado } from '../../dados/tiradas'
import { Buscador, Modal, normalizar, Pestañas } from '../comun'
import { CONDICIONES, conSigno } from '../glosario'
import { descargar } from '../hoja/exportar'
import { idAliado, idCriatura, idPj, ordenIniciativa, siguienteTurno, type FilaIniciativa, type PjMesa } from './iniciativa'
import { leerSesion, lineasDeTareas, PintarSesion, type Edicion } from './notaSesion'
import { borrar as borrarLineas, cambiarTipo, escribirFila, insertar, reemplazar, trasladarTachadas, type Cambio } from './editarSesion'
import { FichaCriatura, useCriaturas } from './FichaCriatura'
import { EditorCriatura } from './Bestiario'

// ── Estado del escenario con guardado diferido (como las hojas de personaje)

function usePantalla(): [Pantalla, (f: (p: Pantalla) => void) => void, string | undefined] {
  const repo = useEstado((s) => s.repo)
  const actual = useRef<Pantalla>(pantallaVacia())
  const pendiente = useRef<number | undefined>(undefined)
  const [, setVersion] = useState(0)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!repo) return
    return repo.pantalla(
      (p) => {
        if (p && pendiente.current === undefined && p.actualizado > actual.current.actualizado) {
          actual.current = { ...pantallaVacia(), ...p }
          setVersion((v) => v + 1)
        }
      },
      (e) => setError(e.message),
    )
  }, [repo])

  const guardar = useCallback(() => {
    pendiente.current = undefined
    repo?.guardarPantalla(actual.current).catch((e: Error) => setError(e.message))
  }, [repo])

  const actualizar = useCallback(
    (f: (p: Pantalla) => void) => {
      const copia = structuredClone(actual.current)
      f(copia)
      copia.actualizado = new Date().toISOString()
      actual.current = copia
      setVersion((v) => v + 1)
      window.clearTimeout(pendiente.current)
      pendiente.current = window.setTimeout(guardar, 400)
    },
    [guardar],
  )

  useEffect(() => () => {
    if (pendiente.current !== undefined) {
      window.clearTimeout(pendiente.current)
      guardar()
    }
  }, [guardar])

  return [actual.current, actualizar, error]
}

type Act = (f: (p: Pantalla) => void) => void

export function PantallaDM() {
  const { repo, personajes, datos, objetos } = useEstado()
  const [pantalla, actualizar, error] = usePantalla()
  const [notas, setNotas] = useState<NotaSesion[]>([])
  const [errorNotas, setErrorNotas] = useState<string>()
  const [panel, setPanel] = useState<'nota' | 'mesa'>('mesa')

  useEffect(() => {
    if (!repo) return
    return repo.sesiones((ns) => setNotas([...ns].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))), (e) => setErrorNotas(e.message))
  }, [repo])

  // Hojas de los PJs activos, recalculadas en vivo
  const activos = useMemo(() => {
    const out: { p: Personaje; h: Hoja }[] = []
    if (!datos) return out
    for (const id of pantalla.pjs) {
      const p = personajes.find((x) => x.id === id)
      if (!p) continue
      try {
        out.push({ p, h: derivar(p, datos, objetos) })
      } catch {
        // hoja incompleta: no se muestra
      }
    }
    return out
  }, [pantalla.pjs, personajes, datos, objetos])

  const denegado = [error, errorNotas].some((e) => e && /permission/i.test(e))

  return (
    <div className="pantalla-dm">
      <header className="pantalla-barra">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>←</button>
        <h1>Pantalla del DM</h1>
        <div className="pantalla-pestañas">
          <Pestañas valor={panel} opciones={[{ id: 'nota', texto: 'Sesión' }, { id: 'mesa', texto: 'Mesa' }]} alCambiar={setPanel} />
        </div>
      </header>
      {denegado && (
        <div className="aviso-banda">
          Firebase no deja guardar la Pantalla del DM. Publica las reglas nuevas de <code>firestore.rules</code> en la consola de Firebase (Firestore → Rules).
        </div>
      )}
      <div className={`pantalla-cuerpo ver-${panel}`}>
        <section className="pantalla-nota">
          <PanelNota notas={notas} pantalla={pantalla} actualizar={actualizar} />
        </section>
        <section className="pantalla-mesa">
          <PanelPjs activos={activos} pantalla={pantalla} actualizar={actualizar} />
          <PanelCombate activos={activos} pantalla={pantalla} actualizar={actualizar} />
          <PanelEscenario pantalla={pantalla} actualizar={actualizar} presentesPjs={activos.map(({ p }) => p.nombre)} />
        </section>
      </div>
    </div>
  )
}

// ── La nota de sesión

const TIPOS_DESPLEGABLE = [
  { clase: 'narracion', texto: 'Narración' },
  { clase: 'dialogo', texto: 'Diálogo' },
  { clase: 'tirada', texto: 'Tiradas' },
  { clase: 'reto', texto: 'Retos' },
  { clase: 'salvacion', texto: 'Salvaciones' },
  { clase: 'dm', texto: 'DM' },
]

function PanelNota({ notas, pantalla, actualizar }: { notas: NotaSesion[]; pantalla: Pantalla; actualizar: Act }) {
  const repo = useEstado((s) => s.repo)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [enfocar, setEnfocar] = useState<number>()
  const entrada = useRef<HTMLInputElement>(null)
  const nota = notas.find((n) => n.id === pantalla.sesion) ?? notas[notas.length - 1]
  // Texto más reciente de la nota: los cambios seguidos se encadenan sin esperar al almacén
  const texto = useRef<{ id?: string; texto: string }>({ texto: '' })
  const pendiente = useRef(0)
  if (nota && (texto.current.id !== nota.id || (nota.texto !== texto.current.texto && pendiente.current === 0))) texto.current = { id: nota.id, texto: nota.texto }
  const historial = useRef<Record<string, { texto: string; tachadas: number[] }[]>>({})
  const [, setVersion] = useState(0)
  const actual = texto.current.texto
  const bloques = useMemo(() => (nota ? leerSesion(actual) : []), [nota, actual])
  const tachadas = nota ? pantalla.tachadas[nota.id] ?? [] : []
  const sinExportar = !!nota?.editada && (!nota.importada || nota.editada > nota.importada)

  const guardarTexto = (nuevo: string, tachadasNuevas: number[]) => {
    if (!nota) return
    const ahora = new Date().toISOString()
    texto.current = { id: nota.id, texto: nuevo }
    pendiente.current++
    setVersion((v) => v + 1)
    void repo
      ?.guardarSesion({ ...nota, texto: nuevo, titulo: tituloNota(nuevo, nota.archivo ?? nota.titulo), editada: ahora, actualizado: ahora })
      .finally(() => (pendiente.current = Math.max(0, pendiente.current - 1)))
    actualizar((p) => void (p.tachadas[nota.id] = tachadasNuevas))
  }

  const aplicar = (f: (t: string) => Cambio & { primera?: number }) => {
    if (!nota) return
    const antes = texto.current.texto
    const c = f(antes)
    if (c.texto === antes) return
    historial.current[nota.id] = [...(historial.current[nota.id] ?? []).slice(-40), { texto: antes, tachadas }]
    guardarTexto(c.texto, trasladarTachadas(lineasDeTareas(antes), lineasDeTareas(c.texto), tachadas, c.mapa))
    if (c.primera !== undefined) {
      setEnfocar(c.primera)
      window.setTimeout(() => setEnfocar(undefined), 80)
    }
  }

  const edicion: Edicion = {
    enfocar,
    reemplazar: (ref, md, borrable) => aplicar((t) => (!md && borrable ? borrarLineas(t, ref.n, ref.fin) : reemplazar(t, ref, md))),
    insertar: (despues, lineas, vacia) => aplicar((t) => insertar(t, despues, lineas, vacia)),
    intro: (it, md) =>
      aplicar((t) => {
        const a = md !== it.texto.trim() ? reemplazar(t, it.ref, md) : { texto: t, mapa: (n: number) => n }
        const b = insertar(a.texto, a.mapa(it.finArbol) ?? it.ref.n, [it.prefijo], null)
        return {
          texto: b.texto,
          primera: b.primera,
          mapa: (n: number) => {
            const x = a.mapa(n)
            return x === null ? null : b.mapa(x)
          },
        }
      }),
    borrar: (n, fin) => aplicar((t) => borrarLineas(t, n, fin)),
    tipo: (n, tipo) => aplicar((t) => cambiarTipo(t, n, tipo)),
    fila: (f, celdas) => aplicar((t) => escribirFila(t, f, celdas)),
  }

  const deshacer = () => {
    if (!nota) return
    const ultimo = historial.current[nota.id]?.pop()
    if (ultimo) guardarTexto(ultimo.texto, ultimo.tachadas)
  }

  const importar = async (archivos: FileList | File[]) => {
    for (const f of Array.from(archivos).filter((f) => /\.md$/i.test(f.name))) {
      const contenido = await f.text()
      const titulo = tituloNota(contenido, f.name)
      // Al volver a importar una nota con el mismo título se actualiza (y se conservan las tachadas)
      const existente = notas.find((n) => n.titulo === titulo || (n.archivo && n.archivo === f.name))
      if (existente?.editada && (!existente.importada || existente.editada > existente.importada)) {
        const ok = confirm(`«${existente.titulo}» tiene cambios hechos en la app que no están en Obsidian. Si la importas, se pierden (expórtala antes si quieres conservarlos). ¿Importar igualmente?`)
        if (!ok) continue
      }
      const ahora = new Date().toISOString()
      const n: NotaSesion = { id: existente?.id ?? nuevoId(), titulo, texto: contenido, archivo: f.name, actualizado: ahora, importada: ahora }
      if (existente) delete historial.current[existente.id]
      texto.current = { id: n.id, texto: contenido }
      await repo?.guardarSesion(n)
      actualizar((p) => void (p.sesion = n.id))
    }
  }

  const nuevaNota = async () => {
    const num = String(notas.length + 1).padStart(2, '0')
    const contenido = `# Sesión ${num} - Título\n\n## Escena 1 - Título\n- [ ] Primera línea de la escena\n`
    const ahora = new Date().toISOString()
    const n: NotaSesion = { id: nuevoId(), titulo: tituloNota(contenido, ''), texto: contenido, archivo: `Sesión ${num} - Título.md`, actualizado: ahora, editada: ahora }
    await repo?.guardarSesion(n)
    actualizar((p) => void (p.sesion = n.id))
    setEditando(true)
  }

  const puedeDeshacer = (historial.current[nota?.id ?? '']?.length ?? 0) > 0

  return (
    <div
      className={`panel-nota ${arrastrando ? 'arrastrando' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setArrastrando(false)
        void importar(e.dataTransfer.files)
      }}
    >
      <div className="nota-cabecera">
        <div className="fila nota-controles">
          <select value={nota?.id ?? ''} onChange={(e) => actualizar((p) => void (p.sesion = e.target.value))}>
            {notas.length === 0 && <option value="">Sin notas de sesión</option>}
            {notas.map((n) => <option key={n.id} value={n.id}>{n.titulo}</option>)}
          </select>
          {nota && (
            <button className={`boton ${editando ? '' : 'secundario'}`} onClick={() => setEditando((v) => !v)} title="Editar la nota en el sitio">
              {editando ? '✓ Terminar' : '✏ Editar'}
            </button>
          )}
          {editando && puedeDeshacer && <button className="boton secundario" onClick={deshacer} title="Deshacer el último cambio">↶ Deshacer</button>}
          <button className="boton secundario" onClick={() => entrada.current?.click()} title="Importar o actualizar una nota de Sesiones/ de la bóveda">Importar .md</button>
          <input ref={entrada} type="file" accept=".md" multiple hidden onChange={(e) => e.target.files && void importar(e.target.files)} />
          {nota && (
            <button
              className={`boton ${sinExportar ? '' : 'secundario'}`}
              onClick={() => descargar(nota.archivo ?? `${nota.titulo}.md`, texto.current.texto)}
              title={sinExportar ? 'Tiene cambios hechos en la app: descárgala para sustituirla en Sesiones/' : 'Descargar la nota'}
            >
              Exportar .md{sinExportar ? ' •' : ''}
            </button>
          )}
          <button className="boton secundario" onClick={() => void nuevaNota()} title="Empezar una nota de sesión en la app">+ Nueva</button>
          {nota && tachadas.length > 0 && !editando && (
            <button className="boton secundario" onClick={() => actualizar((p) => void (p.tachadas[nota.id] = []))}>Destachar todo</button>
          )}
        </div>
        <div className="filtros-nota">
          {TIPOS_DESPLEGABLE.map((t) => (
            <label key={t.clase} className={`chip c-${t.clase}`}>
              <input type="checkbox" checked={!ocultos.includes(t.clase)} onChange={(e) => setOcultos((o) => (e.target.checked ? o.filter((x) => x !== t.clase) : [...o, t.clase]))} />
              {t.texto}
            </label>
          ))}
        </div>
        {editando && (
          <p className="sutil ayuda-edicion">
            Pulsa en cualquier texto para cambiarlo (<kbd>Ctrl</kbd>+<kbd>B</kbd> negrita, <kbd>Ctrl</kbd>+<kbd>I</kbd> cursiva). <kbd>Intro</kbd> guarda y, en una línea, crea otra debajo; <kbd>Esc</kbd> deshace. Con <b>＋</b> añades líneas y tarjetas.
            {sinExportar && ' Los cambios se guardan en la app: exporta la nota para llevarlos a Obsidian.'}
          </p>
        )}
      </div>
      {!nota ? (
        <p className="sutil">
          Arrastra aquí una nota de <code>Sesiones/</code> de la bóveda, o pulsa «Importar .md». Se guarda solo para el DM. Si la cambias en Obsidian, vuelve a importarla: se actualiza y conserva lo tachado.
        </p>
      ) : (
        <article className={`nota-sesion ${editando ? 'editando' : ''}`}>
          <PintarSesion
            bloques={bloques}
            tachadas={tachadas}
            ocultos={ocultos}
            edicion={editando ? edicion : undefined}
            alTachar={(n, hecha) =>
              actualizar((p) => {
                const t = new Set(p.tachadas[nota.id] ?? [])
                if (hecha) t.add(n)
                else t.delete(n)
                p.tachadas[nota.id] = [...t]
              })
            }
          />
        </article>
      )}
    </div>
  )
}

// ── Los PJs activos

function PanelPjs({ activos, pantalla, actualizar }: { activos: { p: Personaje; h: Hoja }[]; pantalla: Pantalla; actualizar: Act }) {
  const personajes = useEstado((s) => s.personajes)
  const fuera = personajes.filter((p) => !pantalla.pjs.includes(p.id))
  return (
    <div className="grupo-mesa">
      <div className="fila grupo-cabecera">
        <h3>Personajes</h3>
        {fuera.length > 0 && (
          <select value="" onChange={(e) => e.target.value && actualizar((p) => void p.pjs.push(e.target.value))}>
            <option value="">+ Añadir a la sesión</option>
            {fuera.map((p) => <option key={p.id} value={p.id}>{p.nombre || 'Sin nombre'}{p.jugador ? ` (${p.jugador})` : ''}</option>)}
          </select>
        )}
      </div>
      {activos.length === 0 && <p className="sutil">Añade los personajes que juegan hoy.</p>}
      <div className="rejilla-pjs">
        {activos.map(({ p, h }) => (
          <TarjetaPj key={p.id} p={p} h={h} quitar={() => actualizar((x) => void (x.pjs = x.pjs.filter((i) => i !== p.id)))} />
        ))}
      </div>
    </div>
  )
}

function BarraPg({ pg, max, temp = 0 }: { pg: number; max: number; temp?: number }) {
  const pct = Math.max(0, Math.min(100, (100 * pg) / Math.max(1, max)))
  return (
    <div className="mini-pg">
      <span className={pg === 0 ? 'error' : ''}><b>{pg}</b>/{max}{temp > 0 && <span className="temp"> +{temp}</span>}</span>
      <div className="hp-barra"><div style={{ width: `${pct}%` }} className={pct < 25 ? 'baja' : pct < 50 ? 'media' : ''} /></div>
    </div>
  )
}

function TarjetaPj({ p, h, quitar }: { p: Personaje; h: Hoja; quitar: () => void }) {
  const e = p.estado
  const pg = e.pgActuales ?? h.pgMax
  const ca = e.forma?.ca ?? h.ca.valor
  return (
    <article className={`tarjeta-mesa pj ${pg === 0 ? 'caido' : ''}`}>
      <header>
        <button className="enlace" onClick={() => ir({ tipo: 'hoja', id: p.id })} title="Abrir la hoja">{p.nombre}</button>
        <span className="sutil">{p.jugador}</span>
        <button className="boton-icono" onClick={quitar} aria-label="Quitar de la sesión" title="Quitar de la sesión">✕</button>
      </header>
      <BarraPg pg={pg} max={h.pgMax} temp={e.pgTemporales} />
      <div className="datos-mesa">
        <span title={e.forma ? `AC de la forma (${e.forma.nombre})` : h.ca.detalle}>AC <b>{ca}</b></span>
        <span>Per. pasiva <b>{h.percepcionPasiva}</b></span>
        <span>Ini <b>{conSigno(h.iniciativa)}</b></span>
        <span>Vel <b>{e.forma?.velocidad ?? `${h.velocidad.andar} ft`}</b></span>
      </div>
      {e.forma && <div className="forma-mesa">🐾 En forma de <b>{e.forma.nombre}</b>{e.forma.notas && <span className="sutil"> · {e.forma.notas}</span>}</div>}
      {pg === 0 && <div className="error">Salvaciones de muerte: {e.salvacionesMuerte.exitos} ✓ · {e.salvacionesMuerte.fallos} ✗</div>}
      <div className="chips-mesa">
        {e.condiciones.map((c) => <span key={c} className="chip condicion">{c}</span>)}
        {e.agotamiento > 0 && <span className="chip condicion">Exhaustion {e.agotamiento}</span>}
        {e.disolucion > 0 && <span className="chip disolucion">Disolución {e.disolucion}</span>}
        {e.concentracion && <span className="chip concentracion">Concentrando: {e.concentracion}</span>}
        {(e.activos ?? []).map((a) => <span key={a} className="chip">{a}</span>)}
        {e.inspiracion && <span className="chip">★ Inspiración</span>}
      </div>
      {(e.aliados ?? []).length > 0 && (
        <ul className="aliados-mesa">
          {(e.aliados ?? []).map((a) => (
            <li key={a.id}>
              <b>{a.nombre}</b> <span className="sutil">{TIPO_ALIADO[a.tipo]}</span> · {a.pg}/{a.pgMax} PG · AC {a.ca}
              {(a.condiciones ?? []).length > 0 && <span className="sutil"> · {a.condiciones!.join(', ')}</span>}
              <div className="sutil">{MODO_INICIATIVA[a.iniciativa]}</div>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

// ── Iniciativa

function PanelCombate({ activos, pantalla, actualizar }: { activos: { p: Personaje; h: Hoja }[]; pantalla: Pantalla; actualizar: Act }) {
  const tiradas = useEstado((s) => s.tiradasCompartidas)
  const c = pantalla.combate
  const pjs: PjMesa[] = activos.map(({ p, h }) => ({ id: p.id, nombre: p.nombre, bonoIniciativa: h.iniciativa, aliados: p.estado.aliados ?? [] }))
  const filas = ordenIniciativa(pantalla, pjs)

  // Las tiradas de iniciativa que comparten los jugadores entran solas (las posteriores al inicio del combate)
  useEffect(() => {
    if (!c.activo) return
    const nuevos: Record<string, number> = {}
    for (const t of [...tiradas].sort((a, b) => a.fecha - b.fecha)) {
      if (t.fecha < c.desde || !/^Iniciativa/.test(t.texto)) continue
      const pj = pjs.find((x) => x.nombre === t.personaje)
      if (!pj) continue
      const aliado = t.texto.split(' · ')[1]
      const a = aliado ? pj.aliados.find((x) => x.nombre === aliado && x.iniciativa === 'propia') : undefined
      const id = a ? idAliado(pj.id, a.id) : aliado ? undefined : idPj(pj.id)
      if (id && c.valores[id] === undefined) nuevos[id] = t.total
    }
    if (Object.keys(nuevos).length) actualizar((p) => void Object.assign(p.combate.valores, nuevos))
  }, [tiradas, c.activo, c.desde, c.valores, pjs, actualizar])

  const tirarCriaturas = () =>
    actualizar((p) => {
      for (const f of filas) {
        if (f.tipo === 'pj' || f.tipo === 'guarida' || p.combate.valores[f.id] !== undefined) continue
        if (f.tipo === 'aliado' && f.aliado?.iniciativa !== 'propia') continue
        p.combate.valores[f.id] = tirarDado(20) + f.bono
      }
    })

  return (
    <div className="grupo-mesa">
      <div className="fila grupo-cabecera">
        <h3>Combate{c.activo && <span className="insignia">Ronda {c.ronda}</span>}</h3>
        {!c.activo ? (
          <button className="boton" onClick={() => actualizar((p) => void (p.combate = { activo: true, ronda: 1, valores: {}, desde: Date.now() }))}>Empezar combate</button>
        ) : (
          <div className="fila">
            <button className="boton secundario" onClick={tirarCriaturas} title="Criaturas y aliados con iniciativa propia que aún no tienen valor">🎲 Tirar iniciativas</button>
            <button className="boton secundario" onClick={() => actualizar((p) => void Object.assign(p.combate, siguienteTurno(filas, p.combate.turno, p.combate.ronda, true)))}>◀</button>
            <button className="boton" onClick={() => actualizar((p) => { Object.assign(p.combate, siguienteTurno(filas, p.combate.turno, p.combate.ronda)); alEmpezarTurno(p, p.combate.turno) })}>Siguiente turno ▶</button>
            <button className="boton secundario" onClick={() => actualizar((p) => void (p.combate.activo = false))}>Terminar</button>
          </div>
        )}
      </div>
      {c.activo && (
        <>
          <p className="sutil">Las iniciativas que tiren los jugadores desde su hoja entran solas. También puedes escribirlas.</p>
          <ol className="lista-iniciativa">
            {filas.map((f) => <FilaIni key={f.id} f={f} turno={c.turno === f.id} actualizar={actualizar} />)}
          </ol>
        </>
      )}
    </div>
  )
}

function FilaIni({ f, turno, actualizar }: { f: FilaIniciativa; turno: boolean; actualizar: Act }) {
  const editable = !(f.tipo === 'aliado' && f.aliado?.iniciativa === 'tras') && f.tipo !== 'guarida'
  return (
    <li className={`fila-ini t-${f.tipo} ${turno ? 'turno' : ''} ${f.criatura && f.criatura.pg === 0 ? 'caido' : ''}`}>
      {editable ? (
        <input
          inputMode="numeric"
          value={f.valor ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d-]/g, '')
            actualizar((p) => {
              if (v === '' || v === '-') delete p.combate.valores[f.id]
              else p.combate.valores[f.id] = Number(v)
            })
          }}
          aria-label={`Iniciativa de ${f.nombre}`}
        />
      ) : (
        <span className="ini-tras">{f.tipo === 'guarida' ? '20' : '↳'}</span>
      )}
      <span className="ini-nombre">
        {f.nombre}
        {f.tipo === 'aliado' && <span className="sutil"> ({f.aliado?.iniciativa === 'tras' ? 'justo después de su PJ' : 'aliado'})</span>}
        {f.enSuTurno.length > 0 && <span className="sutil"> + {f.enSuTurno.map((a) => a.nombre).join(', ')} en su turno</span>}
      </span>
      {f.criatura && f.tipo === 'criatura' && <span className="sutil">{f.criatura.pg}/{f.criatura.plantilla.pgMax} · AC {f.criatura.plantilla.ca}</span>}
      {f.tipo === 'guarida' && <span className="sutil">🏰 acción de guarida (pierde empates)</span>}
      {f.aliado && <span className="sutil">{f.aliado.pg}/{f.aliado.pgMax} · AC {f.aliado.ca}</span>}
      <button className="boton-icono" title="Darle el turno" onClick={() => actualizar((p) => { p.combate.turno = f.id; alEmpezarTurno(p, f.id) })}>▶</button>
    </li>
  )
}

// ── El escenario

/** Al empezar el turno de una criatura: recupera sus acciones legendarias y tira las recargas de lo gastado. */
function alEmpezarTurno(p: Pantalla, turno: string | undefined) {
  if (!turno?.startsWith('cr:')) return
  const c = p.criaturas.find((x) => idCriatura(x.id) === turno)
  if (!c) return
  c.legendariasUsadas = 0
  const avisos: string[] = []
  const quedan: string[] = []
  for (const clave of c.gastadas ?? []) {
    const e = entradas(c.plantilla).find((x) => claveEntrada(x.seccion, x.e) === clave)
    const min = e ? recarga(e.e.nombre) : undefined
    if (!min) continue
    const d = tirarDado(6)
    const nombre = clave.split(':')[1]
    if (d >= min) avisos.push(`${nombre}: ${d} ✓ recargada`)
    else {
      avisos.push(`${nombre}: ${d} ✗`)
      quedan.push(clave)
    }
  }
  c.gastadas = quedan
  c.aviso = avisos.length ? `Recarga · ${avisos.join(' · ')}` : undefined
}

function PanelEscenario({ pantalla, actualizar, presentesPjs }: { pantalla: Pantalla; actualizar: Act; presentesPjs: string[] }) {
  const [nueva, setNueva] = useState(false)
  const [abierta, setAbierta] = useState<string>()
  const criatura = pantalla.criaturas.find((c) => c.id === abierta)
  const presentes = (c: CriaturaEscenario) => [
    ...presentesPjs,
    ...pantalla.criaturas.filter((x) => x.id !== c.id && !x.oculta && x.pg > 0).flatMap((x) => [x.nombre, x.plantilla.nombre]),
  ]
  return (
    <div className="grupo-mesa">
      <div className="fila grupo-cabecera">
        <h3>Escenario</h3>
        <button className="boton" onClick={() => setNueva(true)}>+ Criatura</button>
        {pantalla.criaturas.some((c) => c.pg === 0) && (
          <button className="boton secundario" onClick={() => actualizar((p) => void (p.criaturas = p.criaturas.filter((c) => c.pg > 0)))}>Quitar las derrotadas</button>
        )}
      </div>
      {pantalla.criaturas.length === 0 && <p className="sutil">Añade las criaturas de la escena desde el Bestiario. Las ocultas no entran en la iniciativa hasta que aparecen.</p>}
      <div className="feed-escenario">
        {pantalla.criaturas.map((c) => <TarjetaCriatura key={c.id} c={c} actualizar={actualizar} abrir={() => setAbierta(c.id)} presentes={presentes(c)} />)}
      </div>
      {nueva && <NuevaCriatura actualizar={actualizar} alCerrar={() => setNueva(false)} />}
      {criatura && <HojaCriatura c={criatura} actualizar={actualizar} alCerrar={() => setAbierta(undefined)} presentes={presentes(criatura)} />}
    </div>
  )
}

const cambiarCriatura = (actualizar: Act, id: string, f: (c: CriaturaEscenario) => void) =>
  actualizar((p) => {
    const c = p.criaturas.find((x) => x.id === id)
    if (c) f(c)
  })

function dañar(c: CriaturaEscenario, n: number) {
  const absorbe = Math.min(c.pgTemporales, n)
  c.pgTemporales -= absorbe
  c.pg = Math.max(0, c.pg - (n - absorbe))
}

function TarjetaCriatura({ c, actualizar, abrir, presentes }: { c: CriaturaEscenario; actualizar: Act; abrir: () => void; presentes: string[] }) {
  const [cantidad, setCantidad] = useState('')
  const n = Math.max(0, parseInt(cantidad, 10) || 0)
  const t = c.plantilla
  const cambiar = (f: (x: CriaturaEscenario) => void) => cambiarCriatura(actualizar, c.id, f)
  const legTotal = t.legendarias ? (c.enGuarida ? t.legendarias.usosGuarida ?? t.legendarias.usos : t.legendarias.usos) : 0
  const recargas = entradas(t).filter((x) => recarga(x.e.nombre))
  const diarias = entradas(t).filter((x) => usosPorDia(x.e.nombre))
  const sinergias = (t.sinergias ?? []).filter((e) => sinergiaActiva(e, presentes))
  return (
    <article className={`tarjeta-mesa criatura ${c.pg === 0 ? 'caido' : ''} ${c.oculta ? 'oculta' : ''}`}>
      <header>
        <button className="enlace" onClick={abrir} title="Ver la ficha">{c.nombre}</button>
        <span className="sutil">{[t.tipo?.split(',')[0], t.vd && `VD ${t.vd}`].filter(Boolean).join(' · ')}</span>
        <button className="boton-icono" title={c.oculta ? 'Hacer aparecer' : 'Ocultar'} onClick={() => cambiar((x) => void (x.oculta = !x.oculta))}>{c.oculta ? '🙈' : '👁'}</button>
      </header>
      <BarraPg pg={c.pg} max={t.pgMax} temp={c.pgTemporales} />
      <div className="datos-mesa">
        <span>AC <b>{t.ca}</b></span>
        {t.percepcionPasiva !== undefined && <span>Per. pasiva <b>{t.percepcionPasiva}</b></span>}
        <span>Ini <b>{conSigno(t.bonoIniciativa)}</b></span>
        {t.velocidad && <span>Vel <b>{t.velocidad}</b></span>}
      </div>
      {(legTotal > 0 || recargas.length > 0 || diarias.length > 0 || t.guarida || t.dominio?.length || sinergias.length > 0) && (
        <div className="chips-mesa recursos-criatura">
          {legTotal > 0 && (
            <span className="chip" title="Acciones legendarias que le quedan esta ronda">
              Leg. {Math.max(0, legTotal - (c.legendariasUsadas ?? 0))}/{legTotal}
            </span>
          )}
          {recargas.map(({ seccion, e }) => {
            const clave = claveEntrada(seccion, e)
            const gastada = c.gastadas?.includes(clave)
            return (
              <button
                key={clave}
                className={`chip ${gastada ? 'condicion' : 'exito'}`}
                title={gastada ? 'Gastada: se tira la recarga al empezar su turno' : 'Disponible: púlsalo al usarla'}
                onClick={() => cambiar((x) => void (x.gastadas = gastada ? (x.gastadas ?? []).filter((k) => k !== clave) : [...(x.gastadas ?? []), clave]))}
              >
                {gastada ? '⌛' : '⚡'} {clave.split(':')[1]}
              </button>
            )
          })}
          {diarias.map(({ seccion, e }) => {
            const clave = claveEntrada(seccion, e)
            const total = usosPorDia(e.nombre)!
            const usados = c.usos?.[clave] ?? 0
            return (
              <button
                key={clave}
                className={`chip ${usados >= total ? 'condicion' : ''}`}
                title="Usos por día que le quedan (púlsalo al usar uno)"
                onClick={() => cambiar((x) => void (x.usos = { ...x.usos, [clave]: usados >= total ? 0 : usados + 1 }))}
              >
                {clave.split(':')[1]} {total - usados}/{total}
              </button>
            )
          })}
          {t.guarida && (
            <button className={`chip ${c.enGuarida ? 'concentracion' : ''}`} title="¿Lucha en su guarida?" onClick={() => cambiar((x) => void (x.enGuarida = !x.enGuarida))}>
              🏰 {c.enGuarida ? 'En su guarida' : 'Fuera de su guarida'}
            </button>
          )}
          {t.dominio?.length ? (
            <button className={`chip ${c.dominioRoto ? '' : 'disolucion'}`} title="Dominio del acechador" onClick={() => cambiar((x) => void (x.dominioRoto = !x.dominioRoto))}>
              {c.dominioRoto ? 'Dominio roto' : '🌑 Dominio activo'}
            </button>
          ) : null}
          {sinergias.map((e) => <span key={e.nombre} className="chip concentracion" title={e.texto}>⚡ Sinergia: {nombreSinergia(e)}</span>)}
        </div>
      )}
      {c.aviso && (
        <div className="aviso-criatura">
          {c.aviso} <button className="boton-icono" onClick={() => cambiar((x) => void (x.aviso = undefined))} aria-label="Cerrar">✕</button>
        </div>
      )}
      <div className="fila hp-acciones">
        <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Cantidad" />
        <button className="boton peligro" disabled={!n} onClick={() => { cambiar((x) => dañar(x, n)); setCantidad('') }}>Daño</button>
        <button className="boton exito" disabled={!n} onClick={() => { cambiar((x) => void (x.pg = Math.min(t.pgMax, x.pg + n))); setCantidad('') }}>Curar</button>
      </div>
      <Condiciones lista={c.condiciones} alCambiar={(l) => cambiar((x) => void (x.condiciones = l))} />
    </article>
  )
}

function Condiciones({ lista, alCambiar }: { lista: string[]; alCambiar: (l: string[]) => void }) {
  return (
    <div className="chips-mesa">
      {lista.map((k) => (
        <button key={k} className="chip condicion" title="Quitar" onClick={() => alCambiar(lista.filter((x) => x !== k))}>{k} ✕</button>
      ))}
      <select className="chip" value="" onChange={(e) => e.target.value && alCambiar([...lista, e.target.value])} aria-label="Añadir condición">
        <option value="">+ condición</option>
        {CONDICIONES.filter((k) => !lista.includes(k)).map((k) => <option key={k}>{k}</option>)}
      </select>
    </div>
  )
}

function HojaCriatura({ c, actualizar, alCerrar, presentes }: { c: CriaturaEscenario; actualizar: Act; alCerrar: () => void; presentes: string[] }) {
  const [catalogo] = useCriaturas()
  const t = c.plantilla
  const cambiar = (f: (x: CriaturaEscenario) => void) => cambiarCriatura(actualizar, c.id, f)
  const enCatalogo = catalogo.find((x) => x.id && x.id === t.id)
  const desfasada = enCatalogo && enCatalogo.actualizado !== t.actualizado
  return (
    <Modal titulo={c.nombre} alCerrar={alCerrar} ancho="ancho">
      {desfasada && (
        <div className="aviso-banda">
          La ficha de {enCatalogo.nombre} ha cambiado en el Bestiario.{' '}
          <button className="boton secundario" onClick={() => cambiar((x) => void (x.plantilla = structuredClone(enCatalogo)))}>Actualizarla</button>
        </div>
      )}
      <FichaCriatura c={t} escena={{ cr: c, cambiar, presentes }} />
      <h4>Estado</h4>
      <Condiciones lista={c.condiciones} alCambiar={(l) => cambiar((x) => void (x.condiciones = l))} />
      <div className="rejilla-campos">
        <label className="campo">
          PG
          <input inputMode="numeric" value={c.pg} onChange={(e) => cambiar((x) => void (x.pg = Math.min(t.pgMax, Number(e.target.value.replace(/\D/g, '')) || 0)))} />
        </label>
        <label className="campo">
          PG temporales
          <input inputMode="numeric" value={c.pgTemporales || ''} onChange={(e) => cambiar((x) => void (x.pgTemporales = Number(e.target.value.replace(/\D/g, '')) || 0))} />
        </label>
      </div>
      <label className="campo">
        Notas de esta criatura
        <textarea rows={3} value={c.notas ?? ''} onChange={(e) => cambiar((x) => void (x.notas = e.target.value))} />
      </label>
      <div className="fila-botones">
        <button
          className="boton secundario"
          onClick={() =>
            actualizar((p) => {
              const i = p.criaturas.findIndex((x) => x.id === c.id)
              p.criaturas.splice(i + 1, 0, { ...structuredClone(c), id: nuevoId(), nombre: `${c.nombre} (copia)`, pg: t.pgMax, pgTemporales: 0, condiciones: [], usos: {}, gastadas: [], legendariasUsadas: 0, aviso: undefined })
            })
          }
        >
          Duplicar
        </button>
        <button
          className="boton peligro"
          onClick={() => {
            actualizar((p) => {
              p.criaturas = p.criaturas.filter((x) => x.id !== c.id)
              delete p.combate.valores[idCriatura(c.id)]
            })
            alCerrar()
          }}
        >
          Quitar del escenario
        </button>
      </div>
    </Modal>
  )
}

function NuevaCriatura({ actualizar, alCerrar }: { actualizar: Act; alCerrar: () => void }) {
  const repo = useEstado((s) => s.repo)
  const [catalogo] = useCriaturas()
  const [q, setQ] = useState('')
  const [elegida, setElegida] = useState<string>()
  const [cantidad, setCantidad] = useState(1)
  const [oculta, setOculta] = useState(false)
  const [tirarPg, setTirarPg] = useState(false)
  const [enGuarida, setEnGuarida] = useState(false)
  const [creando, setCreando] = useState(false)
  const t = catalogo.find((c) => c.id === elegida)
  const lista = catalogo.filter((c) => !q || normalizar(`${c.nombre} ${c.tipo ?? ''}`).includes(normalizar(q)))

  const añadir = () => {
    if (!t) return
    actualizar((p) => {
      const iguales = p.criaturas.filter((x) => x.plantilla.nombre === t.nombre).length
      for (let i = 1; i <= cantidad; i++) {
        const pg = tirarPg && t.pgFormula && formulaValida(t.pgFormula) ? Math.max(1, resolverTirada({ etiqueta: 'PG', formula: t.pgFormula }).total) : t.pgMax
        const numero = iguales + i
        const nombre = cantidad > 1 || iguales > 0 ? `${t.nombre} ${numero}` : t.nombre
        p.criaturas.push({ id: nuevoId(), nombre, plantilla: structuredClone(t), pg, pgTemporales: 0, condiciones: [], oculta, enGuarida: enGuarida && !!t.guarida })
      }
    })
    alCerrar()
  }

  if (creando)
    return (
      <EditorCriatura
        c={criaturaVacia()}
        alCerrar={() => setCreando(false)}
        alGuardar={async (c) => {
          await repo?.guardarCriatura(c)
          setElegida(c.id)
          setCreando(false)
        }}
      />
    )

  return (
    <Modal titulo="Añadir criaturas" alCerrar={alCerrar} ancho="ancho">
      <div className="fila">
        <Buscador valor={q} alCambiar={setQ} texto="Buscar en el Bestiario…" />
        <button className="boton secundario" onClick={() => setCreando(true)}>+ Nueva en el Bestiario</button>
      </div>
      {catalogo.length === 0 && <p className="sutil">El Bestiario está vacío: crea una criatura o importa las notas de <code>Bestiario/</code> desde el inicio («Bestiario»).</p>}
      <div className="lista-elegir">
        {lista.map((c) => (
          <button key={c.id} className={`fila-elegir ${c.id === elegida ? 'elegida' : ''}`} onClick={() => setElegida(c.id)}>
            <b>{c.nombre}</b>
            <span className="sutil">{[c.tipo, c.vd && `VD ${c.vd}`, `AC ${c.ca}`, `PG ${c.pgMax}`].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
      </div>
      {t && (
        <>
          <div className="rejilla-campos">
            <label className="campo">Cuántas<input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 1)))} /></label>
          </div>
          {t.pgFormula && <label className="interruptor"><input type="checkbox" checked={tirarPg} onChange={(e) => setTirarPg(e.target.checked)} /> Tirar los PG ({t.pgFormula}) en vez de usar la media ({t.pgMax})</label>}
          {t.guarida && <label className="interruptor"><input type="checkbox" checked={enGuarida} onChange={(e) => setEnGuarida(e.target.checked)} /> Luchan en su guarida</label>}
          <label className="interruptor"><input type="checkbox" checked={oculta} onChange={(e) => setOculta(e.target.checked)} /> Ocultas (no aparecen todavía)</label>
          <details className="previa-criatura">
            <summary>Ver la ficha</summary>
            <FichaCriatura c={t} />
          </details>
        </>
      )}
      <div className="fila-botones">
        <button className="boton" disabled={!t} onClick={añadir}>Añadir {cantidad > 1 ? `${cantidad} criaturas` : 'criatura'}</button>
      </div>
    </Modal>
  )
}
