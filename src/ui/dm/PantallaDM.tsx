// Pantalla del DM: la nota de sesión a un lado y la mesa al otro (PJs en vivo, iniciativa y escenario de criaturas).
// El escenario se guarda en el almacén (solo DM); los PJs, sus aliados y sus formas llegan en vivo de sus hojas.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ir, useEstado } from '../../estado/store'
import { derivar, type Hoja } from '../../motor/derivar'
import type { Personaje } from '../../motor/personaje'
import { nuevoId } from '../../motor/personaje'
import { MODO_INICIATIVA, TIPO_ALIADO } from '../../motor/compania'
import { pantallaVacia, tituloNota, type CriaturaEscenario, type NotaSesion, type PantallaDM as Pantalla, type PlantillaCriatura } from '../../almacen/pantalla'
import { formulaValida, resolverTirada, tirarDado } from '../../dados/tiradas'
import { Modal, Pestañas } from '../comun'
import { ABREV, CONDICIONES, conSigno } from '../glosario'
import { CARACTERISTICAS } from '../../datos/tipos'
import { modificador } from '../../motor/personaje'
import { idAliado, idCriatura, idPj, ordenIniciativa, siguienteTurno, type FilaIniciativa, type PjMesa } from './iniciativa'
import { leerSesion, PintarSesion } from './notaSesion'

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
          <PanelEscenario pantalla={pantalla} actualizar={actualizar} />
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
  const entrada = useRef<HTMLInputElement>(null)
  const nota = notas.find((n) => n.id === pantalla.sesion) ?? notas[notas.length - 1]
  const bloques = useMemo(() => (nota ? leerSesion(nota.texto) : []), [nota])
  const tachadas = nota ? pantalla.tachadas[nota.id] ?? [] : []

  const importar = async (archivos: FileList | File[]) => {
    for (const f of Array.from(archivos).filter((f) => /\.md$/i.test(f.name))) {
      const texto = await f.text()
      const titulo = tituloNota(texto, f.name)
      // Al volver a importar una nota con el mismo título se actualiza (y se conservan las tachadas)
      const existente = notas.find((n) => n.titulo === titulo)
      const n: NotaSesion = { id: existente?.id ?? nuevoId(), titulo, texto, actualizado: new Date().toISOString() }
      await repo?.guardarSesion(n)
      actualizar((p) => void (p.sesion = n.id))
    }
  }

  return (
    <div
      className={`panel-nota ${arrastrando ? 'arrastrando' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault()
        setArrastrando(false)
        void importar(e.dataTransfer.files)
      }}
    >
      <div className="fila nota-controles">
        <select value={nota?.id ?? ''} onChange={(e) => actualizar((p) => void (p.sesion = e.target.value))}>
          {notas.length === 0 && <option value="">Sin notas de sesión</option>}
          {notas.map((n) => <option key={n.id} value={n.id}>{n.titulo}</option>)}
        </select>
        <button className="boton secundario" onClick={() => entrada.current?.click()} title="Importar o actualizar una nota de Sesiones/ de la bóveda">Importar .md</button>
        <input ref={entrada} type="file" accept=".md" multiple hidden onChange={(e) => e.target.files && void importar(e.target.files)} />
        {nota && tachadas.length > 0 && (
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
      {!nota ? (
        <p className="sutil">
          Arrastra aquí una nota de <code>Sesiones/</code> de la bóveda, o pulsa «Importar .md». Se guarda solo para el DM. Si la cambias en Obsidian, vuelve a importarla: se actualiza y conserva lo tachado.
        </p>
      ) : (
        <article className="nota-sesion">
          <PintarSesion
            bloques={bloques}
            tachadas={tachadas}
            ocultos={ocultos}
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
        if (f.tipo === 'pj' || p.combate.valores[f.id] !== undefined) continue
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
            <button className="boton" onClick={() => actualizar((p) => void Object.assign(p.combate, siguienteTurno(filas, p.combate.turno, p.combate.ronda)))}>Siguiente turno ▶</button>
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
  const editable = !(f.tipo === 'aliado' && f.aliado?.iniciativa === 'tras')
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
        <span className="ini-tras">↳</span>
      )}
      <span className="ini-nombre">
        {f.nombre}
        {f.tipo === 'aliado' && <span className="sutil"> ({f.aliado?.iniciativa === 'tras' ? 'justo después de su PJ' : 'aliado'})</span>}
        {f.enSuTurno.length > 0 && <span className="sutil"> + {f.enSuTurno.map((a) => a.nombre).join(', ')} en su turno</span>}
      </span>
      {f.criatura && <span className="sutil">{f.criatura.pg}/{f.criatura.plantilla.pgMax} · AC {f.criatura.plantilla.ca}</span>}
      {f.aliado && <span className="sutil">{f.aliado.pg}/{f.aliado.pgMax} · AC {f.aliado.ca}</span>}
      <button className="boton-icono" title="Darle el turno" onClick={() => actualizar((p) => void (p.combate.turno = f.id))}>▶</button>
    </li>
  )
}

// ── El escenario

function PanelEscenario({ pantalla, actualizar }: { pantalla: Pantalla; actualizar: Act }) {
  const [nueva, setNueva] = useState(false)
  const [abierta, setAbierta] = useState<string>()
  const criatura = pantalla.criaturas.find((c) => c.id === abierta)
  return (
    <div className="grupo-mesa">
      <div className="fila grupo-cabecera">
        <h3>Escenario</h3>
        <button className="boton" onClick={() => setNueva(true)}>+ Criatura</button>
        {pantalla.criaturas.some((c) => c.pg === 0) && (
          <button className="boton secundario" onClick={() => actualizar((p) => void (p.criaturas = p.criaturas.filter((c) => c.pg > 0)))}>Quitar las derrotadas</button>
        )}
      </div>
      {pantalla.criaturas.length === 0 && <p className="sutil">Añade las criaturas de la escena. Las ocultas no entran en la iniciativa hasta que aparecen.</p>}
      <div className="feed-escenario">
        {pantalla.criaturas.map((c) => <TarjetaCriatura key={c.id} c={c} actualizar={actualizar} abrir={() => setAbierta(c.id)} />)}
      </div>
      {nueva && <NuevaCriatura pantalla={pantalla} actualizar={actualizar} alCerrar={() => setNueva(false)} />}
      {criatura && <HojaCriatura c={criatura} actualizar={actualizar} alCerrar={() => setAbierta(undefined)} />}
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

function TarjetaCriatura({ c, actualizar, abrir }: { c: CriaturaEscenario; actualizar: Act; abrir: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const n = Math.max(0, parseInt(cantidad, 10) || 0)
  const t = c.plantilla
  return (
    <article className={`tarjeta-mesa criatura ${c.pg === 0 ? 'caido' : ''} ${c.oculta ? 'oculta' : ''}`}>
      <header>
        <button className="enlace" onClick={abrir} title="Ver la hoja">{c.nombre}</button>
        <span className="sutil">{[t.tipo, t.vd && `VD ${t.vd}`].filter(Boolean).join(' · ')}</span>
        <button className="boton-icono" title={c.oculta ? 'Hacer aparecer' : 'Ocultar'} onClick={() => cambiarCriatura(actualizar, c.id, (x) => void (x.oculta = !x.oculta))}>{c.oculta ? '🙈' : '👁'}</button>
      </header>
      <BarraPg pg={c.pg} max={t.pgMax} temp={c.pgTemporales} />
      <div className="datos-mesa">
        <span>AC <b>{t.ca}</b></span>
        {t.percepcionPasiva !== undefined && <span>Per. pasiva <b>{t.percepcionPasiva}</b></span>}
        <span>Ini <b>{conSigno(t.bonoIniciativa)}</b></span>
        {t.velocidad && <span>Vel <b>{t.velocidad}</b></span>}
      </div>
      <div className="fila hp-acciones">
        <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Cantidad" />
        <button className="boton peligro" disabled={!n} onClick={() => { cambiarCriatura(actualizar, c.id, (x) => dañar(x, n)); setCantidad('') }}>Daño</button>
        <button className="boton exito" disabled={!n} onClick={() => { cambiarCriatura(actualizar, c.id, (x) => void (x.pg = Math.min(t.pgMax, x.pg + n))); setCantidad('') }}>Curar</button>
      </div>
      <Condiciones lista={c.condiciones} alCambiar={(l) => cambiarCriatura(actualizar, c.id, (x) => void (x.condiciones = l))} />
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

function HojaCriatura({ c, actualizar, alCerrar }: { c: CriaturaEscenario; actualizar: Act; alCerrar: () => void }) {
  const t = c.plantilla
  return (
    <Modal titulo={c.nombre} alCerrar={alCerrar} ancho="ancho">
      <p className="sutil">{[t.tipo, t.vd && `VD ${t.vd}`, t.velocidad && `Speed ${t.velocidad}`].filter(Boolean).join(' · ')}</p>
      <div className="datos-mesa grandes">
        <span>AC <b>{t.ca}</b></span>
        <span>PG <b>{c.pg}/{t.pgMax}</b>{t.pgFormula && <span className="sutil"> ({t.pgFormula})</span>}</span>
        <span>Iniciativa <b>{conSigno(t.bonoIniciativa)}</b></span>
        {t.percepcionPasiva !== undefined && <span>Per. pasiva <b>{t.percepcionPasiva}</b></span>}
      </div>
      {t.caracteristicas && Object.keys(t.caracteristicas).length > 0 && (
        <div className="caracteristicas-criatura">
          {CARACTERISTICAS.map((k) => {
            const v = t.caracteristicas?.[k]
            return v === undefined ? null : <div key={k}><span>{ABREV[k]}</span><b>{v}</b><span>{conSigno(modificador(v))}</span></div>
          })}
        </div>
      )}
      {t.texto && <div className="texto-criatura">{t.texto.split(/\n{2,}/).map((par, i) => <p key={i}>{par}</p>)}</div>}
      <h4>Estado</h4>
      <Condiciones lista={c.condiciones} alCambiar={(l) => cambiarCriatura(actualizar, c.id, (x) => void (x.condiciones = l))} />
      <label className="campo">
        PG temporales
        <input inputMode="numeric" value={c.pgTemporales || ''} onChange={(e) => cambiarCriatura(actualizar, c.id, (x) => void (x.pgTemporales = Number(e.target.value.replace(/\D/g, '')) || 0))} />
      </label>
      <label className="campo">
        Notas de esta criatura
        <textarea rows={3} value={c.notas ?? ''} onChange={(e) => cambiarCriatura(actualizar, c.id, (x) => void (x.notas = e.target.value))} />
      </label>
      <div className="fila-botones">
        <button
          className="boton secundario"
          onClick={() =>
            actualizar((p) => {
              const i = p.criaturas.findIndex((x) => x.id === c.id)
              p.criaturas.splice(i + 1, 0, { ...structuredClone(c), id: nuevoId(), nombre: `${c.nombre} (copia)`, pg: t.pgMax, pgTemporales: 0, condiciones: [] })
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

const plantillaVacia = (): PlantillaCriatura => ({ nombre: '', ca: 10, pgMax: 10, bonoIniciativa: 0 })

function NuevaCriatura({ pantalla, actualizar, alCerrar }: { pantalla: Pantalla; actualizar: Act; alCerrar: () => void }) {
  const [t, setT] = useState<PlantillaCriatura>(plantillaVacia)
  const [cantidad, setCantidad] = useState(1)
  const [oculta, setOculta] = useState(false)
  const num = (v: string) => Number(v.replace(/[^\d-]/g, '')) || 0
  const campo = <K extends keyof PlantillaCriatura>(k: K, v: PlantillaCriatura[K]) => setT((x) => ({ ...x, [k]: v }))
  const formulaOk = !t.pgFormula || formulaValida(t.pgFormula)

  const añadir = () => {
    actualizar((p) => {
      for (let i = 1; i <= cantidad; i++) {
        const pg = t.pgFormula && formulaOk ? Math.max(1, resolverTirada({ etiqueta: 'PG', formula: t.pgFormula }).total) : t.pgMax
        p.criaturas.push({ id: nuevoId(), nombre: cantidad > 1 ? `${t.nombre} ${i}` : t.nombre, plantilla: structuredClone(t), pg, pgTemporales: 0, condiciones: [], oculta })
      }
      p.plantillas = [...p.plantillas.filter((x) => x.nombre !== t.nombre), structuredClone(t)]
    })
    alCerrar()
  }

  return (
    <Modal titulo="Añadir criaturas" alCerrar={alCerrar} ancho="ancho">
      {pantalla.plantillas.length > 0 && (
        <label className="campo">
          Usar una ya creada
          <select value="" onChange={(e) => { const x = pantalla.plantillas.find((p) => p.nombre === e.target.value); if (x) setT(structuredClone(x)) }}>
            <option value="">—</option>
            {pantalla.plantillas.map((p) => <option key={p.nombre}>{p.nombre}</option>)}
          </select>
        </label>
      )}
      <p className="sutil">Hasta que exista el catálogo de criaturas, la ficha se escribe aquí y se guarda para reutilizarla.</p>
      <div className="rejilla-campos">
        <label className="campo">Nombre<input value={t.nombre} onChange={(e) => campo('nombre', e.target.value)} /></label>
        <label className="campo">Cuántas<input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(20, num(e.target.value))))} /></label>
        <label className="campo">Tipo<input value={t.tipo ?? ''} onChange={(e) => campo('tipo', e.target.value)} placeholder="Monstruosidad (Acechador)" /></label>
        <label className="campo">VD<input value={t.vd ?? ''} onChange={(e) => campo('vd', e.target.value)} /></label>
        <label className="campo">AC<input inputMode="numeric" value={t.ca} onChange={(e) => campo('ca', num(e.target.value))} /></label>
        <label className="campo">PG<input inputMode="numeric" value={t.pgMax} onChange={(e) => campo('pgMax', num(e.target.value))} /></label>
        <label className="campo">Fórmula de PG<input value={t.pgFormula ?? ''} onChange={(e) => campo('pgFormula', e.target.value || undefined)} placeholder="6d8+12 (opcional)" className={formulaOk ? '' : 'error'} /></label>
        <label className="campo">Bono de iniciativa<input value={t.bonoIniciativa} onChange={(e) => campo('bonoIniciativa', num(e.target.value))} /></label>
        <label className="campo">Percepción pasiva<input inputMode="numeric" value={t.percepcionPasiva ?? ''} onChange={(e) => campo('percepcionPasiva', e.target.value ? num(e.target.value) : undefined)} /></label>
        <label className="campo">Velocidad<input value={t.velocidad ?? ''} onChange={(e) => campo('velocidad', e.target.value)} placeholder="40 ft" /></label>
      </div>
      <div className="rejilla-campos car">
        {CARACTERISTICAS.map((k) => (
          <label key={k} className="campo">
            {ABREV[k]}
            <input
              inputMode="numeric"
              value={t.caracteristicas?.[k] ?? ''}
              onChange={(e) => setT((x) => ({ ...x, caracteristicas: { ...x.caracteristicas, [k]: e.target.value ? num(e.target.value) : undefined } }))}
            />
          </label>
        ))}
      </div>
      <label className="campo">
        Rasgos y acciones
        <textarea rows={6} value={t.texto ?? ''} onChange={(e) => campo('texto', e.target.value)} placeholder={'Mordisco. +4, 5 ft. 1d6+2 perforante.\n\nDesfasado. Insight CD 15...'} />
      </label>
      <label className="interruptor"><input type="checkbox" checked={oculta} onChange={(e) => setOculta(e.target.checked)} /> Ocultas (no aparecen todavía)</label>
      <div className="fila-botones">
        <button className="boton" disabled={!t.nombre.trim() || !formulaOk} onClick={añadir}>Añadir {cantidad > 1 ? `${cantidad} criaturas` : 'criatura'}</button>
      </div>
    </Modal>
  )
}

