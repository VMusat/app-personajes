// Bandeja de dados: anima las tiradas y guarda el historial.
// El resultado lo calcula la app (generador criptográfico) antes de animar: los dados ruedan y, al pararse,
// cada uno muestra exactamente su valor. No hay física: nada se queda torcido ni hay discrepancias,
// y varias tiradas seguidas se encolan sin bloquear la página.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEstado, guardarPreferencia } from '../estado/store'
import { ColorDados } from '../ui/Apariencia'
import { formulaValida, resolverTirada, tirarDado, type PeticionTirada, type ResultadoTirada } from './tiradas'

const DURACION = 950
const MAX_DADOS_VISIBLES = 30
const TIPOS = [4, 6, 8, 10, 12, 20, 100] as const

const sinMovimiento = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Silueta de cada tipo de dado (viewBox 0 0 100 100). */
function Silueta({ caras }: { caras: number }) {
  switch (caras) {
    case 4:
      return <polygon points="50,6 95,90 5,90" />
    case 6:
      return <rect x="10" y="10" width="80" height="80" rx="12" />
    case 8:
      return <polygon points="50,4 95,50 50,96 5,50" />
    case 10:
      return <polygon points="50,4 93,40 50,96 7,40" />
    case 12:
      return <polygon points="50,4 95,37 78,93 22,93 5,37" />
    case 20:
      return (
        <>
          <polygon points="50,3 93,26 93,74 50,97 7,74 7,26" />
          <polygon className="arista" points="50,22 78,70 22,70" />
        </>
      )
    default:
      return <circle cx="50" cy="50" r="45" />
  }
}

interface DadoVisible {
  clave: string
  caras: number
  valor: number
  descartado?: boolean
  negativo?: boolean
  estilo: CSSProperties
}

function dadosDe(r: ResultadoTirada): DadoVisible[] {
  const res: DadoVisible[] = []
  r.dados.forEach((g, gi) => {
    const todos = [...g.valores.map((v) => ({ v, d: false })), ...(g.descartados ?? []).map((v) => ({ v, d: true }))]
    todos.forEach((x, i) => {
      const k = res.length
      res.push({
        clave: `${gi}-${i}`,
        caras: g.caras,
        valor: x.v,
        descartado: x.d,
        negativo: g.signo === -1,
        // Cada dado entra desde un lado distinto, con giros completos para acabar derecho
        estilo: {
          '--dx': `${(k % 2 ? 1 : -1) * (60 + ((k * 37) % 90))}px`,
          '--giro': `${(k % 2 ? 1 : -1) * (720 + 360 * (k % 3))}deg`,
          animationDelay: `${Math.min(k, 8) * 45}ms`,
        } as CSSProperties,
      })
    })
  })
  return res
}

function Dado({ d, rodando, critico, pifia }: { d: DadoVisible; rodando: boolean; critico?: boolean; pifia?: boolean }) {
  // Mientras rueda, la cara cambia rápido; al pararse queda el valor real
  const [cara, setCara] = useState(d.valor)
  useEffect(() => {
    if (!rodando) {
      setCara(d.valor)
      return
    }
    const t = window.setInterval(() => setCara(tirarDado(d.caras)), 70)
    return () => window.clearInterval(t)
  }, [rodando, d.valor, d.caras])
  const clase = ['dado', `d${d.caras}`, rodando ? 'rodando' : 'quieto', d.descartado ? 'descartado' : '', !rodando && critico && d.caras === 20 && !d.descartado ? 'nat20' : '', !rodando && pifia && d.caras === 20 && !d.descartado ? 'nat1' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={clase} style={d.estilo} aria-label={`d${d.caras}: ${d.valor}${d.descartado ? ' (descartado)' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <Silueta caras={d.caras} />
        <text x="50" y={d.caras === 4 ? 70 : 55} textAnchor="middle" dominantBaseline="middle" fontSize={d.caras === 100 || cara >= 100 ? 26 : 36}>
          {d.negativo ? `−${cara}` : cara}
        </text>
      </svg>
      <small>d{d.caras}</small>
    </span>
  )
}

export function Bandeja() {
  const { colaTiradas, set, tirar } = useEstado()
  const [activo, setActivo] = useState<ResultadoTirada | null>(null)
  const [rodando, setRodando] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const ocupado = useRef(false)
  const temporizador = useRef<number>(undefined)

  // Procesa la cola de una en una
  useEffect(() => {
    if (ocupado.current || !colaTiradas.length) return
    const p = colaTiradas[0]
    ocupado.current = true
    set({ colaTiradas: colaTiradas.slice(1) })
    window.clearTimeout(temporizador.current)
    const r = resolverTirada(p)
    setActivo(r)
    setRodando(true)
    // Si hay más tiradas esperando, la animación se acorta
    const duracion = sinMovimiento() ? 120 : colaTiradas.length > 1 ? 450 : DURACION
    window.setTimeout(() => {
      setRodando(false)
      ocupado.current = false
      try {
        p.alTerminar?.(r)
      } catch (e) {
        console.error(e)
      }
      const st = useEstado.getState()
      st.set({ tiradas: [r, ...st.tiradas].slice(0, 100), colaTiradas: [...st.colaTiradas] })
      if (st.compartirTiradas && st.repo && p.personaje) {
        void st.repo.compartirTirada({ personaje: p.personaje, texto: r.etiqueta, total: r.total, detalle: describir(r) }).catch(() => {})
      }
      temporizador.current = window.setTimeout(() => setActivo(null), 7000)
    }, duracion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaTiradas])

  const cerrar = () => {
    window.clearTimeout(temporizador.current)
    if (!rodando) setActivo(null)
  }

  const visibles = useMemo(() => (activo ? dadosDe(activo) : []), [activo])

  return (
    <>
      {activo && (
        <div className={`resultado-tirada ${!rodando && activo.critico ? 'critico' : ''} ${!rodando && activo.pifia ? 'pifia' : ''}`} role="status" aria-live="polite">
          <div className="rt-etiqueta">{activo.etiqueta}</div>
          <div className="mesa-dados">
            {visibles.slice(0, MAX_DADOS_VISIBLES).map((d) => (
              <Dado key={`${activo.id}${d.clave}`} d={d} rodando={rodando} critico={activo.critico} pifia={activo.pifia} />
            ))}
            {visibles.length > MAX_DADOS_VISIBLES && <span className="sutil">+{visibles.length - MAX_DADOS_VISIBLES} dados</span>}
            {activo.modificador !== 0 && <span className="rt-mod">{activo.modificador > 0 ? '+' : '−'}{Math.abs(activo.modificador)}</span>}
          </div>
          <div className={`rt-total ${rodando ? 'oculto' : ''}`}>{rodando ? '…' : activo.total}</div>
          {!rodando && (
            <>
              <div className="rt-detalle">{describir(activo)}</div>
              {activo.critico && activo.natural === 20 && <div className="rt-aviso">¡Natural 20!</div>}
              {activo.pifia && <div className="rt-aviso pifia">Natural 1</div>}
              <div className="fila-botones">
                {activo.dano && (
                  <button
                    className="boton"
                    onClick={() =>
                      tirar({ etiqueta: `Daño: ${activo.etiqueta.replace(/^Ataque: /, '')}`, formula: activo.dano!.formula, critico: !!activo.critico, personaje: activo.personaje })
                    }
                  >
                    Tirar daño{activo.critico ? ' (crítico)' : ''}
                  </button>
                )}
                <button className="boton secundario" onClick={cerrar}>Cerrar</button>
              </div>
            </>
          )}
        </div>
      )}

      <button className="boton-dados" onClick={() => setAbierta(!abierta)} aria-label="Dados e historial" aria-expanded={abierta}>
        🎲
      </button>
      {abierta && <PanelDados alCerrar={() => setAbierta(false)} />}
    </>
  )

}

function PanelDados({ alCerrar }: { alCerrar: () => void }) {
  const { tiradas, set, tirar, compartirTiradas } = useEstado()
  // Reserva de dados para tirar varios a la vez y combinar tipos
  const [reserva, setReserva] = useState<Record<number, number>>({})
  const [mod, setMod] = useState(0)
  const [formula, setFormula] = useState('')
  const [modo, setModo] = useState<'normal' | 'ventaja' | 'desventaja'>('normal')
  const formulaReserva =
    TIPOS.filter((c) => reserva[c])
      .map((c) => `${reserva[c]}d${c}`)
      .join('+') + (mod ? (mod > 0 ? `+${mod}` : `${mod}`) : '')
  const soloUnD20 = Object.keys(reserva).length === 1 && reserva[20] === 1
  const añadir = (c: number, n = 1) => setReserva((r) => ({ ...r, [c]: Math.max(0, Math.min(50, (r[c] ?? 0) + n)) }))
  const lanzar = (f: string) => {
    if (!formulaValida(f)) return
    const d20 = /^1?d20([+-]\d+)?$/.test(f)
    tirar({ etiqueta: f, formula: f, d20, ventaja: d20 && modo !== 'normal' ? modo : undefined })
  }
  return (
    <aside className="panel-dados">
      <header>
        <h3>Dados</h3>
        <button className="boton-icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
      </header>
      <p className="sutil">Pulsa un dado para añadirlo a la tirada. Puedes combinar varios y de distintos tipos.</p>
      <div className="dados-rapidos">
        {TIPOS.map((c) => (
          <button key={c} className="boton-dado-tipo" onClick={() => añadir(c)} aria-label={`Añadir d${c}`}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <Silueta caras={c} />
            </svg>
            <span>d{c}</span>
            {reserva[c] ? <b className="contador-reserva">{reserva[c]}</b> : null}
          </button>
        ))}
      </div>
      <div className="fila reserva">
        <span className="formula-reserva">{formulaReserva || 'Ningún dado'}</span>
        <span className="contador">
          <button className="boton-mini" onClick={() => setMod(mod - 1)} aria-label="Restar 1 al modificador">−</button>
          <span>{mod >= 0 ? `+${mod}` : mod}</span>
          <button className="boton-mini" onClick={() => setMod(mod + 1)} aria-label="Sumar 1 al modificador">+</button>
        </span>
      </div>
      {soloUnD20 && (
        <div className="selector-ventaja">
          {(['desventaja', 'normal', 'ventaja'] as const).map((m) => (
            <button key={m} className={modo === m ? 'activo' : ''} onClick={() => setModo(m)}>
              {m === 'normal' ? 'Normal' : m === 'ventaja' ? 'Ventaja' : 'Desventaja'}
            </button>
          ))}
        </div>
      )}
      <div className="fila-botones">
        <button className="boton" disabled={!formulaValida(formulaReserva)} onClick={() => lanzar(formulaReserva)}>
          Tirar {formulaReserva}
        </button>
        <button className="boton secundario" onClick={() => (setReserva({}), setMod(0))}>Vaciar</button>
      </div>
      <form
        className="fila"
        onSubmit={(e) => {
          e.preventDefault()
          lanzar(formula.replace(/\s/g, ''))
        }}
      >
        <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="o escribe: 2d6+1d4+3" aria-label="Fórmula" />
        <button className="boton secundario" disabled={!formulaValida(formula.replace(/\s/g, ''))}>Tirar</button>
      </form>
      <h4>Color de los dados</h4>
      <ColorDados />
      <label className="interruptor">
        <input
          type="checkbox"
          checked={compartirTiradas}
          onChange={(e) => {
            set({ compartirTiradas: e.target.checked })
            guardarPreferencia('compartirTiradas', e.target.checked)
          }}
        />
        Compartir las tiradas de mis personajes con la mesa
      </label>
      <h4>Historial</h4>
      <ol className="historial">
        {tiradas.map((t) => (
          <li key={t.id}>
            <span className="h-total">{t.total}</span>
            <span>
              <b>{t.etiqueta}</b>
              <small>{describir(t)}</small>
            </span>
            <button className="boton-mini" title="Repetir" aria-label={`Repetir ${t.formula}`} onClick={() => tirar({ etiqueta: t.etiqueta, formula: t.formula, d20: /^1?d20/.test(t.formula), ventaja: t.ventaja })}>
              ↻
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}

export function describir(r: ResultadoTirada): string {
  const dados = r.dados
    .map((d) => `${d.signo === -1 ? '−' : ''}${d.valores.length}d${d.caras} [${d.valores.join(', ')}${d.descartados ? ` · descartado ${d.descartados.join(', ')}` : ''}]`)
    .join(' + ')
  const mod = r.modificador ? ` ${r.modificador > 0 ? '+' : '−'} ${Math.abs(r.modificador)}` : ''
  const v = r.ventaja ? ` (${r.ventaja})` : ''
  return `${dados}${mod}${v}`
}
