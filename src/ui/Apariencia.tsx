// Ventana para elegir el modo (claro/oscuro), la paleta de la app y el color de los dados.
import { useState } from 'react'
import { Modal } from './comun'
import { NOMBRE_MODO, NOMBRE_PALETA, PALETAS, esOscuro, guardarApariencia, leerApariencia, muestra, type Apariencia, type Modo, type Paleta } from './temas'

function useApariencia(): [Apariencia, (p: Partial<Apariencia>) => void] {
  const [a, setA] = useState(leerApariencia)
  const cambiar = (p: Partial<Apariencia>) => {
    const nueva = { ...a, ...p }
    setA(nueva)
    guardarApariencia(nueva)
  }
  return [a, cambiar]
}

export function SelectorPaleta({ valor, alCambiar, oscuro, etiqueta }: { valor: Paleta; alCambiar: (p: Paleta) => void; oscuro: boolean; etiqueta: string }) {
  return (
    <div className="grupo-apariencia" role="radiogroup" aria-label={etiqueta}>
      {PALETAS.map((p) => (
        <button key={p} role="radio" aria-checked={valor === p} className={`opcion-apariencia ${valor === p ? 'activa' : ''}`} onClick={() => alCambiar(p)}>
          <span className="punto" style={{ background: muestra(p, oscuro) }} />
          {NOMBRE_PALETA[p]}
        </button>
      ))}
    </div>
  )
}

export function VentanaApariencia({ alCerrar }: { alCerrar: () => void }) {
  const [a, cambiar] = useApariencia()
  const oscuro = esOscuro(a)
  return (
    <Modal titulo="Apariencia" alCerrar={alCerrar}>
      <p className="sutil">Se guarda en este dispositivo.</p>
      <h4>Tema</h4>
      <div className="grupo-apariencia" role="radiogroup" aria-label="Tema">
        {(['sistema', 'claro', 'oscuro'] as Modo[]).map((m) => (
          <button key={m} role="radio" aria-checked={a.modo === m} className={`opcion-apariencia ${a.modo === m ? 'activa' : ''}`} onClick={() => cambiar({ modo: m })}>
            {m === 'claro' ? '☀' : m === 'oscuro' ? '☾' : '◐'} {NOMBRE_MODO[m]}
          </button>
        ))}
      </div>
      <h4>Colores de la app</h4>
      <SelectorPaleta valor={a.paleta} alCambiar={(p) => cambiar({ paleta: p })} oscuro={oscuro} etiqueta="Colores de la app" />
      <h4>Color de los dados</h4>
      <SelectorPaleta valor={a.dados} alCambiar={(p) => cambiar({ dados: p })} oscuro={oscuro} etiqueta="Color de los dados" />
    </Modal>
  )
}

/** Selector compacto del color de los dados (para el panel de dados). */
export function ColorDados() {
  const [a, cambiar] = useApariencia()
  return <SelectorPaleta valor={a.dados} alCambiar={(p) => cambiar({ dados: p })} oscuro={esOscuro(a)} etiqueta="Color de los dados" />
}
