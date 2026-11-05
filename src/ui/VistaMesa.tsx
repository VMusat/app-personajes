// La mesa que ven los jugadores: el orden de iniciativa del combate y los relojes que el DM enseña.
// La publica la Pantalla del DM; aquí solo se lee. Sirve también para una pantalla grande en la mesa.
import { ir, useEstado } from '../estado/store'
import { formatoTiempo, restanteReloj, TEXTO_SALUD, type MesaPublica, type Reloj } from '../almacen/mesa'
import { RelojVista, useAhora } from './dm/Herramientas'

const hayMesa = (m: MesaPublica | null): m is MesaPublica => !!m && (!!m.combate || m.relojes.length > 0)

/** Nombre de quien tiene el turno. */
const turnoDe = (m: MesaPublica) => m.combate?.filas.find((f) => f.id === m.combate?.turno)

export function VistaMesa() {
  const mesa = useEstado((s) => s.mesa)
  const personajes = useEstado((s) => s.personajes)
  const repo = useEstado((s) => s.repo)
  const ahora = useAhora(!!mesa?.relojes.some((r) => r.fin !== undefined))
  // Los PJs propios (en el DM serían todos: no se marca ninguno como «tuyo»)
  const mios = repo?.esDM() ? [] : personajes.map((p) => `pj:${p.id}`)
  const turno = mesa ? turnoDe(mesa) : undefined
  return (
    <div className="vista-mesa">
      <header className="fila cabecera-mesa">
        <button className="boton secundario" onClick={() => ir({ tipo: 'inicio' })}>←</button>
        <h1>La mesa</h1>
        {mesa?.combate && <span className="insignia">Ronda {mesa.combate.ronda}</span>}
      </header>
      {!hayMesa(mesa) && <p className="sutil">Ahora mismo no hay ningún combate ni reloj en marcha. Cuando el DM empiece un combate, el orden de iniciativa aparecerá aquí.</p>}
      {mesa && mesa.relojes.length > 0 && (
        <div className="relojes-mesa">
          {mesa.relojes.map((r) => <RelojVista key={r.id} r={r} ahora={ahora} grande />)}
        </div>
      )}
      {mesa?.combate && (
        <>
          {turno && (
            <p className={`turno-mesa ${mios.includes(turno.id) ? 'tuyo' : ''}`}>
              {mios.includes(turno.id) ? <>¡Te toca, <b>{turno.nombre}</b>!</> : <>Turno de <b>{turno.nombre}</b></>}
            </p>
          )}
          <ol className="iniciativa-mesa">
            {mesa.combate.filas.map((f) => (
              <li key={f.id} className={`t-${f.tipo} ${f.id === mesa.combate!.turno ? 'turno' : ''} ${f.salud === 'caido' ? 'caido' : ''} ${mios.includes(f.id) ? 'mio' : ''}`}>
                <span className="ini-valor">{f.valor ?? '—'}</span>
                <span className="ini-nombre">
                  {f.nombre}
                  {f.condiciones.length > 0 && <span className="chips-mesa">{f.condiciones.map((c) => <span key={c} className="chip condicion">{c}</span>)}</span>}
                </span>
                {f.pg ? <span className="ini-pg">{f.pg}</span> : f.salud && <span className={`salud s-${f.salud}`}>{TEXTO_SALUD[f.salud]}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

/** Aviso compacto para el inicio y la hoja: hay combate o reloj en marcha. Lleva a la mesa. */
export function AvisoMesa({ pj }: { pj?: string }) {
  const mesa = useEstado((s) => s.mesa)
  const ahora = useAhora(!!mesa?.relojes.some((r) => r.fin !== undefined), 1000)
  if (!hayMesa(mesa)) return null
  const turno = turnoDe(mesa)
  const tuyo = !!pj && turno?.id === `pj:${pj}`
  return (
    <button className={`aviso-mesa ${tuyo ? 'tuyo' : ''}`} onClick={() => ir({ tipo: 'mesa' })} title="Ver la mesa">
      {mesa.combate && (
        <span>⚔ Ronda {mesa.combate.ronda}{turno && <> · {tuyo ? <b>¡Te toca!</b> : <>turno de <b>{turno.nombre}</b></>}</>}</span>
      )}
      {mesa.relojes.map((r) => (
        <span key={r.id} className="aviso-reloj">⏳ <RelojTexto r={r} ahora={ahora} /></span>
      ))}
      <span className="sutil">Ver la mesa →</span>
    </button>
  )
}

function RelojTexto({ r, ahora }: { r: Reloj; ahora: number }) {
  if (r.modo === 'pasos') return <>{r.nombre} {r.hechos}/{r.total}</>
  const ms = restanteReloj(r, ahora)
  return <>{r.nombre} {ms === 0 ? '¡Tiempo!' : formatoTiempo(ms)}</>
}
