// Componentes básicos reutilizables.
import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({ titulo, alCerrar, children, ancho }: { titulo: ReactNode; alCerrar: () => void; children: ReactNode; ancho?: 'normal' | 'ancho' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', tecla)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', tecla)
  }, [alCerrar])
  return (
    <div className="modal-fondo" onClick={alCerrar}>
      <div className={`modal ${ancho === 'ancho' ? 'modal-ancho' : ''}`} onClick={(e) => e.stopPropagation()} ref={ref} tabIndex={-1} role="dialog" aria-modal="true">
        <header className="modal-cabecera">
          <h3>{titulo}</h3>
          <button className="boton-icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </header>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export function Contador({ valor, max, alCambiar, etiqueta }: { valor: number; max: number; alCambiar: (v: number) => void; etiqueta?: string }) {
  // Casillas si son pocas; si no, botones − / +
  if (max <= 8) {
    return (
      <span className="casillas" aria-label={etiqueta}>
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            className={`casilla ${i < valor ? 'gastada' : ''}`}
            onClick={() => alCambiar(i < valor ? i : i + 1)}
            aria-label={`${i < valor ? 'Recuperar' : 'Gastar'} uso ${i + 1}`}
          />
        ))}
      </span>
    )
  }
  return (
    <span className="contador">
      <button className="boton-mini" onClick={() => alCambiar(Math.max(0, valor - 1))} aria-label="Recuperar uno">−</button>
      <span>{max - valor} / {max}</span>
      <button className="boton-mini" onClick={() => alCambiar(Math.min(max, valor + 1))} aria-label="Gastar uno">+</button>
    </span>
  )
}

export function Pestañas<T extends string>({ valor, opciones, alCambiar }: { valor: T; opciones: { id: T; texto: string }[]; alCambiar: (v: T) => void }) {
  return (
    <nav className="pestañas" role="tablist">
      {opciones.map((o) => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} className={valor === o.id ? 'activa' : ''} onClick={() => alCambiar(o.id)}>
          {o.texto}
        </button>
      ))}
    </nav>
  )
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="cargando">
      <div className="runa" aria-hidden />
      <p>{texto}</p>
    </div>
  )
}

export function Buscador({ valor, alCambiar, texto = 'Buscar…' }: { valor: string; alCambiar: (v: string) => void; texto?: string }) {
  return <input className="buscador" type="search" placeholder={texto} value={valor} onChange={(e) => alCambiar(e.target.value)} />
}

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
