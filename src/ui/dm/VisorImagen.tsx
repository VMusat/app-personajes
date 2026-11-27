// Imágenes incrustadas en las notas de sesión («![[La Cuadra.svg]]»): se ven en la nota y se amplían en un visor
// a pantalla completa (rueda o pellizco para ampliar, arrastrar para mover, doble clic para alternar).
import { createContext, useContext, useEffect, useRef, useState, type PointerEvent as EventoPuntero, type WheelEvent as EventoRueda } from 'react'
import { createPortal } from 'react-dom'

/** Imágenes importadas: nombre de archivo en minúsculas → data URL. */
export const ImagenesCtx = createContext<Record<string, string>>({})

/** Incrustaciones de Obsidian en un texto: «![[nombre]]» o «![[nombre|300]]». */
export const RE_INCRUSTADA = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g

/** Una imagen de la nota, ancha y con un botón para ampliarla. Si no se ha importado, avisa de cómo hacerlo. */
export function FiguraSesion({ nombre }: { nombre: string }) {
  const imagenes = useContext(ImagenesCtx)
  const src = imagenes[nombre.trim().toLowerCase()]
  const [abierta, setAbierta] = useState(false)
  if (!src)
    return (
      <div className="sesion-figura falta">
        🗺 <b>{nombre}</b>: no está importada. Arrastra el archivo (de <code>Recursos/Mapas</code>) a la nota, o pulsa «Importar».
      </div>
    )
  return (
    <figure className="sesion-figura">
      <button className="sesion-figura-boton" onClick={() => setAbierta(true)} title="Ampliar">
        <img src={src} alt={nombre} draggable={false} />
      </button>
      <figcaption>
        {nombre.replace(/\.\w+$/, '')} <button className="boton-mini" onClick={() => setAbierta(true)}>🔍 Ampliar</button>
      </figcaption>
      {abierta && <VisorImagen src={src} nombre={nombre} alCerrar={() => setAbierta(false)} />}
    </figure>
  )
}

const MIN = 0.5
const MAX = 10

/** Visor a pantalla completa con zoom hacia el puntero y arrastre. */
export function VisorImagen({ src, nombre, alCerrar }: { src: string; nombre: string; alCerrar: () => void }) {
  const [vista, setVista] = useState({ z: 1, x: 0, y: 0 })
  const lienzo = useRef<HTMLDivElement>(null)
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<{ x: number; y: number; vx: number; vy: number; d?: number; z?: number } | null>(null)

  // Mientras está abierto, la página de detrás no se desliza
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
      else if (e.key === '+' || e.key === '=') zoomCentro(1.25)
      else if (e.key === '-') zoomCentro(1 / 1.25)
      else if (e.key === '0') setVista({ z: 1, x: 0, y: 0 })
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  /** Amplía manteniendo quieto el punto (sx, sy) de la pantalla. */
  const zoomEn = (factor: number, sx: number, sy: number) =>
    setVista((v) => {
      const r = lienzo.current?.getBoundingClientRect()
      const cx = r ? r.left + r.width / 2 : 0
      const cy = r ? r.top + r.height / 2 : 0
      const z = Math.min(MAX, Math.max(MIN, v.z * factor))
      const lx = (sx - cx - v.x) / v.z
      const ly = (sy - cy - v.y) / v.z
      return { z, x: sx - cx - lx * z, y: sy - cy - ly * z }
    })
  const zoomCentro = (factor: number) => {
    const r = lienzo.current?.getBoundingClientRect()
    if (r) zoomEn(factor, r.left + r.width / 2, r.top + r.height / 2)
  }

  const rueda = (e: EventoRueda<HTMLDivElement>) => zoomEn(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)
  const bajar = (e: EventoPuntero<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* sin captura, el arrastre sigue funcionando dentro del visor */
    }
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ps = [...punteros.current.values()]
    if (ps.length === 2) gesto.current = { x: 0, y: 0, vx: vista.x, vy: vista.y, d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), z: vista.z }
    else gesto.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }
  }
  const mover = (e: EventoPuntero<HTMLDivElement>) => {
    if (!punteros.current.has(e.pointerId) || !gesto.current) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const ps = [...punteros.current.values()]
    const g = gesto.current
    if (ps.length === 2 && g.d && g.z) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)
      const factor = (g.z * (d / g.d)) / vista.z
      zoomEn(factor, (ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2)
    } else if (ps.length === 1) setVista((v) => ({ ...v, x: g.vx + e.clientX - g.x, y: g.vy + e.clientY - g.y }))
  }
  const soltar = (e: EventoPuntero<HTMLDivElement>) => {
    punteros.current.delete(e.pointerId)
    const ps = [...punteros.current.values()]
    gesto.current = ps.length === 1 ? { x: ps[0].x, y: ps[0].y, vx: vista.x, vy: vista.y } : null
  }

  return createPortal(
    <div className="visor-imagen" role="dialog" aria-modal="true" aria-label={nombre}>
      <div className="visor-barra">
        <span className="visor-nombre">{nombre.replace(/\.\w+$/, '')}</span>
        <button className="boton secundario" onClick={() => zoomCentro(1 / 1.25)} aria-label="Alejar">−</button>
        <button className="boton secundario" onClick={() => setVista({ z: 1, x: 0, y: 0 })} title="Ajustar a la pantalla (0)">{Math.round(vista.z * 100)} %</button>
        <button className="boton secundario" onClick={() => zoomCentro(1.25)} aria-label="Acercar">+</button>
        <button className="boton" onClick={alCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div
        ref={lienzo}
        className="visor-lienzo"
        onWheel={rueda}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onDoubleClick={(e) => (vista.z > 1.01 ? setVista({ z: 1, x: 0, y: 0 }) : zoomEn(2.5, e.clientX, e.clientY))}
      >
        <img src={src} alt={nombre} draggable={false} style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.z})` }} />
      </div>
      <p className="visor-ayuda">Rueda o pellizco para ampliar · arrastra para moverte · doble clic para acercar o volver · Esc para cerrar</p>
    </div>,
    document.body,
  )
}
