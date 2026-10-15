// Bandeja de dados: anima las tiradas con dados 3D (dice-box) y guarda el historial.
// Si el navegador no admite WebGL, tira sin animación 3D.
import { useEffect, useRef, useState } from 'react'
import { useEstado, guardarPreferencia } from '../estado/store'
import { dadosALanzar, formulaValida, resolverTirada, type PeticionTirada, type ResultadoTirada } from './tiradas'

type Caja = {
  init: () => Promise<unknown>
  roll: (n: string[]) => Promise<{ sides: number; rolls: { value: number }[] }[]>
  clear: () => void
  show: () => Caja
  hide: () => Caja
}

let promesaCaja: Promise<Caja | null> | null = null
function cargarCaja(): Promise<Caja | null> {
  if (promesaCaja) return promesaCaja
  promesaCaja = (async () => {
    try {
      const { default: DiceBox } = await import('@3d-dice/dice-box')
      const assetPath = new URL('assets/dice-box/', document.baseURI).pathname
      const caja = new DiceBox({ container: '#caja-dados', assetPath, origin: location.origin, theme: 'default', themeColor: '#7a4fd6', scale: 6, offscreen: true }) as unknown as Caja
      await Promise.race([caja.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))])
      return caja
    } catch (e) {
      console.warn('Dados 3D no disponibles, se usa la tirada simple', e)
      return null
    }
  })()
  return promesaCaja
}

export function Bandeja() {
  const { colaTiradas, tiradas, set, tirar, repo, compartirTiradas } = useEstado()
  const [activo, setActivo] = useState<ResultadoTirada | null>(null)
  const [lanzando, setLanzando] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const [formula, setFormula] = useState('1d20')
  const ocupado = useRef(false)
  const temporizador = useRef<number>(undefined)

  useEffect(() => {
    if (ocupado.current || !colaTiradas.length) return
    const p = colaTiradas[0]
    ocupado.current = true
    set({ colaTiradas: colaTiradas.slice(1) })
    void lanzar(p).finally(() => {
      ocupado.current = false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaTiradas])

  async function lanzar(p: PeticionTirada) {
    window.clearTimeout(temporizador.current)
    setLanzando(true)
    setActivo(null)
    const caja = await cargarCaja()
    let valores: number[][] | undefined
    const notacion = dadosALanzar(p)
    if (caja && notacion.length) {
      try {
        caja.show()
        const res = await caja.roll(notacion)
        valores = res.map((g) => g.rolls.map((r) => r.value))
      } catch {
        valores = undefined
      }
    } else {
      await new Promise((r) => setTimeout(r, 450))
    }
    const r = resolverTirada(p, valores)
    p.alTerminar?.(r)
    setLanzando(false)
    setActivo(r)
    set({ tiradas: [r, ...useEstado.getState().tiradas].slice(0, 100) })
    if (compartirTiradas && repo && p.personaje) {
      void repo.compartirTirada({
        personaje: p.personaje,
        texto: r.etiqueta,
        total: r.total,
        detalle: describir(r),
      }).catch(() => {})
    }
    temporizador.current = window.setTimeout(() => {
      caja?.clear()
      caja?.hide()
      setActivo(null)
    }, 6000)
  }

  const cerrar = () => {
    window.clearTimeout(temporizador.current)
    void cargarCaja().then((c) => {
      c?.clear()
      c?.hide()
    })
    setActivo(null)
  }

  return (
    <>
      <div id="caja-dados" className={lanzando || activo ? 'visible' : ''} onClick={cerrar} />
      {(lanzando || activo) && (
        <div className={`resultado-tirada ${activo?.critico ? 'critico' : ''} ${activo?.pifia ? 'pifia' : ''}`} role="status" aria-live="polite">
          {lanzando && !activo && <div className="dado-girando" aria-label="Tirando">🎲</div>}
          {activo && (
            <>
              <div className="rt-etiqueta">{activo.etiqueta}</div>
              <div className="rt-total">{activo.total}</div>
              <div className="rt-detalle">{describir(activo)}</div>
              {activo.critico && <div className="rt-aviso">¡Natural 20!</div>}
              {activo.pifia && <div className="rt-aviso">Natural 1</div>}
              <div className="fila-botones">
                {activo.dano && (
                  <button
                    className="boton"
                    onClick={() => tirar({ etiqueta: `Daño: ${activo.etiqueta.replace(/^Ataque: /, '')}`, formula: activo.dano!.formula, critico: !!activo.critico, personaje: activo.personaje })}
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

      <button className="boton-dados" onClick={() => setAbierta(!abierta)} aria-label="Dados e historial">🎲</button>
      {abierta && (
        <aside className="panel-dados">
          <header>
            <h3>Dados</h3>
            <button className="boton-icono" onClick={() => setAbierta(false)} aria-label="Cerrar">✕</button>
          </header>
          <div className="dados-rapidos">
            {[4, 6, 8, 10, 12, 20, 100].map((c) => (
              <button key={c} className="boton secundario" onClick={() => tirar({ etiqueta: `d${c}`, formula: `1d${c}`, d20: c === 20 })}>d{c}</button>
            ))}
          </div>
          <form
            className="fila"
            onSubmit={(e) => {
              e.preventDefault()
              if (formulaValida(formula)) tirar({ etiqueta: formula, formula, d20: /^1?d20/.test(formula) })
            }}
          >
            <input value={formula} onChange={(e) => setFormula(e.target.value)} aria-label="Fórmula" />
            <button className="boton" disabled={!formulaValida(formula)}>Tirar</button>
          </form>
          <div className="fila-botones">
            <button className="boton secundario" onClick={() => tirar({ etiqueta: 'd20 con ventaja', formula: '1d20', d20: true, ventaja: 'ventaja' })}>Ventaja</button>
            <button className="boton secundario" onClick={() => tirar({ etiqueta: 'd20 con desventaja', formula: '1d20', d20: true, ventaja: 'desventaja' })}>Desventaja</button>
          </div>
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
              </li>
            ))}
          </ol>
        </aside>
      )}
    </>
  )
}

export function describir(r: ResultadoTirada): string {
  const dados = r.dados
    .map((d) => `${d.valores.length}d${d.caras} [${d.valores.join(', ')}${d.descartados ? ` · descartado ${d.descartados.join(', ')}` : ''}]`)
    .join(' + ')
  const mod = r.modificador ? ` ${r.modificador > 0 ? '+' : '−'} ${Math.abs(r.modificador)}` : ''
  const v = r.ventaja ? ` (${r.ventaja})` : ''
  return `${dados}${mod}${v}`
}
