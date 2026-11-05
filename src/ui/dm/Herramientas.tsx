// Herramientas de la mesa: relojes (cuentas atrás y relojes de pasos) y apuntes rápidos.
// Los relojes visibles los ven también los jugadores en la vista de mesa.
import { useEffect, useRef, useState } from 'react'
import {
  alternarReloj, formatoTiempo, nuevoReloj, reiniciarReloj, restanteReloj, sumarReloj, type Apunte, type Reloj,
} from '../../almacen/mesa'
import type { PantallaDM } from '../../almacen/pantalla'
import { nuevoId } from '../../motor/personaje'

type Act = (f: (p: PantallaDM) => void) => void

/** La hora actual, refrescada cada `ms` mientras `activo`. */
export function useAhora(activo: boolean, ms = 250): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return
    const t = window.setInterval(() => setAhora(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [activo, ms])
  return activo ? ahora : Date.now()
}

/** Un pitido corto (sin archivos de audio). */
function pitar() {
  try {
    const ctx = new AudioContext()
    for (const [i, f] of [880, 660, 880].entries()) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.22)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.22)
      o.stop(ctx.currentTime + i * 0.22 + 0.2)
    }
    window.setTimeout(() => void ctx.close(), 1200)
  } catch {
    // sin audio
  }
}

/** Reloj de pasos: un círculo partido en sectores. */
function CirculoPasos({ total, hechos, alPulsar, grande }: { total: number; hechos: number; alPulsar?: (i: number) => void; grande?: boolean }) {
  const r = 40
  const sectores = Array.from({ length: total }, (_, i) => {
    const a0 = (2 * Math.PI * i) / total - Math.PI / 2
    const a1 = (2 * Math.PI * (i + 1)) / total - Math.PI / 2
    const largo = a1 - a0 > Math.PI ? 1 : 0
    const d = total === 1
      ? `M 50 ${50 - r} A ${r} ${r} 0 1 1 49.99 ${50 - r} Z`
      : `M 50 50 L ${50 + r * Math.cos(a0)} ${50 + r * Math.sin(a0)} A ${r} ${r} 0 ${largo} 1 ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)} Z`
    return <path key={i} d={d} className={i < hechos ? 'lleno' : ''} onClick={() => alPulsar?.(i < hechos ? i : i + 1)} />
  })
  return (
    <svg viewBox="0 0 100 100" className={`circulo-pasos ${grande ? 'grande' : ''} ${alPulsar ? 'pulsable' : ''}`} role="img" aria-label={`${hechos} de ${total} pasos`}>
      {sectores}
    </svg>
  )
}

/** Un reloj tal como lo ven los jugadores (y la cabecera del DM). */
export function RelojVista({ r, ahora, grande }: { r: Reloj; ahora: number; grande?: boolean }) {
  if (r.modo === 'pasos')
    return (
      <div className={`reloj-vista pasos ${r.hechos >= r.total ? 'agotado' : ''} ${grande ? 'grande' : ''}`}>
        <CirculoPasos total={r.total} hechos={r.hechos} grande={grande} />
        <div><div className="reloj-nombre">{r.nombre}</div><div className="reloj-tiempo">{r.hechos}/{r.total}</div></div>
      </div>
    )
  const ms = restanteReloj(r, ahora)
  return (
    <div className={`reloj-vista ${ms === 0 ? 'agotado' : ''} ${r.fin === undefined && ms > 0 ? 'parado' : ''} ${grande ? 'grande' : ''}`}>
      <div className="reloj-nombre">{r.nombre}</div>
      <div className="reloj-tiempo">{ms === 0 ? '¡Tiempo!' : formatoTiempo(ms)}</div>
      <div className="reloj-barra"><div style={{ width: `${(100 * ms) / Math.max(1, r.total * 1000)}%` }} /></div>
    </div>
  )
}

const PRESETS = [1, 3, 5, 10]

export function PanelRelojes({ relojes, actualizar }: { relojes: Reloj[]; actualizar: Act }) {
  const [nuevo, setNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [modo, setModo] = useState<Reloj['modo']>('tiempo')
  const [minutos, setMinutos] = useState('5')
  const [pasos, setPasos] = useState('6')
  const [visible, setVisible] = useState(true)
  const enMarcha = relojes.some((r) => r.fin !== undefined)
  const ahora = useAhora(enMarcha)
  const pitados = useRef(new Set<string>())

  // Pita una vez al acabar cada cuenta atrás
  useEffect(() => {
    for (const r of relojes) {
      if (r.modo !== 'tiempo' || r.fin === undefined) {
        pitados.current.delete(r.id)
        continue
      }
      if (restanteReloj(r, ahora) === 0 && !pitados.current.has(r.id)) {
        pitados.current.add(r.id)
        pitar()
      }
    }
  }, [relojes, ahora])

  const cambiar = (id: string, f: (r: Reloj) => void) =>
    actualizar((p) => {
      const r = p.relojes?.find((x) => x.id === id)
      if (r) f(r)
    })

  const crear = () => {
    const total = modo === 'tiempo' ? Math.round(Math.max(0.1, parseFloat(minutos.replace(',', '.')) || 5) * 60) : Math.max(1, Math.min(12, parseInt(pasos, 10) || 6))
    const r = nuevoReloj(nuevoId(), nombre.trim() || (modo === 'tiempo' ? 'Tiempo' : 'Reloj'), modo, total, visible)
    actualizar((p) => void (p.relojes = [...(p.relojes ?? []), r]))
    setNuevo(false)
    setNombre('')
  }

  return (
    <div className="grupo-mesa">
      <div className="fila grupo-cabecera">
        <h3>Relojes</h3>
        <button className="boton secundario" onClick={() => setNuevo((v) => !v)}>{nuevo ? 'Cancelar' : '+ Reloj'}</button>
      </div>
      {nuevo && (
        <div className="nuevo-reloj">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Qué cuenta (p. ej. «El techo se derrumba»)" aria-label="Nombre del reloj" />
          <div className="fila">
            <select value={modo} onChange={(e) => setModo(e.target.value as Reloj['modo'])} aria-label="Tipo de reloj">
              <option value="tiempo">Cuenta atrás (tiempo real)</option>
              <option value="pasos">Reloj de pasos (se marcan a mano)</option>
            </select>
            {modo === 'tiempo' ? (
              <>
                <label className="fila">
                  <input className="corto" inputMode="decimal" value={minutos} onChange={(e) => setMinutos(e.target.value)} aria-label="Minutos" /> min
                </label>
                {PRESETS.map((m) => <button key={m} className="chip" onClick={() => setMinutos(String(m))}>{m}′</button>)}
              </>
            ) : (
              <label className="fila">
                <input className="corto" inputMode="numeric" value={pasos} onChange={(e) => setPasos(e.target.value)} aria-label="Pasos" /> pasos
              </label>
            )}
          </div>
          <div className="fila">
            <label className="interruptor"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Lo ven los jugadores</label>
            <button className="boton" onClick={crear}>Crear</button>
          </div>
        </div>
      )}
      {relojes.length === 0 && !nuevo && <p className="sutil">Una cuenta atrás para cuando los PJs van contra el tiempo, o un reloj de pasos para una amenaza que avanza.</p>}
      <div className="lista-relojes">
        {relojes.map((r) => {
          const ms = restanteReloj(r, ahora)
          return (
            <div key={r.id} className={`reloj-dm ${r.modo === 'tiempo' && ms === 0 ? 'agotado' : ''}`}>
              {r.modo === 'tiempo' ? (
                <RelojVista r={r} ahora={ahora} />
              ) : (
                <div className="reloj-vista pasos">
                  <CirculoPasos total={r.total} hechos={r.hechos} alPulsar={(n) => cambiar(r.id, (x) => void (x.hechos = n))} />
                  <div><div className="reloj-nombre">{r.nombre}</div><div className="reloj-tiempo">{r.hechos}/{r.total}</div></div>
                </div>
              )}
              <div className="fila reloj-controles">
                {r.modo === 'tiempo' ? (
                  <>
                    <button className="boton" disabled={ms === 0} onClick={() => cambiar(r.id, (x) => alternarReloj(x, Date.now()))}>{r.fin !== undefined ? '⏸' : '▶'}</button>
                    <button className="boton-mini" onClick={() => cambiar(r.id, (x) => sumarReloj(x, -60, Date.now()))} title="Quitar un minuto">−1′</button>
                    <button className="boton-mini" onClick={() => cambiar(r.id, (x) => sumarReloj(x, 60, Date.now()))} title="Añadir un minuto">+1′</button>
                  </>
                ) : (
                  <>
                    <button className="boton-mini" onClick={() => cambiar(r.id, (x) => void (x.hechos = Math.max(0, x.hechos - 1)))} aria-label="Quitar un paso">−</button>
                    <button className="boton" onClick={() => cambiar(r.id, (x) => void (x.hechos = Math.min(x.total, x.hechos + 1)))}>Avanza</button>
                  </>
                )}
                <button className="boton-mini" onClick={() => cambiar(r.id, reiniciarReloj)} title="Reiniciar">↺</button>
                <button className={`boton-mini ${r.visible ? 'activo' : ''}`} onClick={() => cambiar(r.id, (x) => void (x.visible = !x.visible))} title={r.visible ? 'Lo ven los jugadores: pulsa para ocultarlo' : 'Solo lo ves tú: pulsa para enseñarlo'}>
                  {r.visible ? '👁' : '🙈'}
                </button>
                <button className="boton-mini" onClick={() => actualizar((p) => void (p.relojes = (p.relojes ?? []).filter((x) => x.id !== r.id)))} aria-label="Quitar el reloj">✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

/** Línea de un apunte tal como se pasa a la nota de sesión. */
export const lineaApunte = (a: Apunte) => `- ${hora(a.fecha)}${a.ronda ? ` (ronda ${a.ronda})` : ''} · ${a.texto}`

export function PanelApuntes({ apuntes, ronda, actualizar, pasarANota }: { apuntes: Apunte[]; ronda?: number; actualizar: Act; pasarANota?: () => void }) {
  const [texto, setTexto] = useState('')
  const [copiado, setCopiado] = useState(false)
  const añadir = () => {
    const t = texto.trim()
    if (!t) return
    actualizar((p) => void (p.apuntes = [...(p.apuntes ?? []), { id: nuevoId(), texto: t, fecha: new Date().toISOString(), ...(ronda ? { ronda } : {}) }]))
    setTexto('')
  }
  return (
    <div className="grupo-mesa">
      <div className="fila grupo-cabecera">
        <h3>Apuntes</h3>
        {apuntes.length > 0 && (
          <>
            <button
              className="boton secundario"
              onClick={() => {
                void navigator.clipboard?.writeText(apuntes.map(lineaApunte).join('\n')).then(() => {
                  setCopiado(true)
                  window.setTimeout(() => setCopiado(false), 1500)
                })
              }}
            >
              {copiado ? '✓ Copiados' : 'Copiar'}
            </button>
            {pasarANota && <button className="boton secundario" onClick={pasarANota} title="Añadirlos al final de la nota de sesión abierta, en «Apuntes de la mesa»">Pasar a la nota</button>}
          </>
        )}
      </div>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && añadir()}
        placeholder="Apunta algo y pulsa Intro (un nombre improvisado, una promesa, un PNJ herido…)"
        aria-label="Nuevo apunte"
      />
      {apuntes.length > 0 && (
        <ul className="lista-apuntes">
          {[...apuntes].reverse().map((a) => (
            <li key={a.id}>
              <span className="sutil">{hora(a.fecha)}{a.ronda ? ` · R${a.ronda}` : ''}</span>
              <span className="apunte-texto">{a.texto}</span>
              <button className="boton-icono" onClick={() => actualizar((p) => void (p.apuntes = (p.apuntes ?? []).filter((x) => x.id !== a.id)))} aria-label="Borrar el apunte">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
