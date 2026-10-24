// Acciones de combate de las reglas (Dash, Hide, Grapple...) con lo que cada una supone para este personaje:
// DC de Grapple y Shove, movimiento extra, número de ataques, tiradas, saltos... La explicación va plegada.
import { useState, type ReactNode } from 'react'
import { useEstado } from '../../estado/store'
import type { Hoja } from '../../motor/derivar'
import { ABREV, conSigno } from '../glosario'

type Tipo = 'Action' | 'Bonus Action' | 'Reaction' | 'Movimiento'

interface Accion {
  nombre: string
  tipo: Tipo[]
  /** Explicación de la regla (plegada). */
  texto: string
  /** Lo que significa para este personaje, en corto. */
  datos?: ReactNode
  /** Habilidades que se pueden tirar. */
  habilidades?: string[]
}

export function Acciones({ h, nombrePj, ventaja }: { h: Hoja; nombrePj: string; ventaja?: 'ventaja' | 'desventaja' }) {
  const tirar = useEstado((s) => s.tirar)
  const [abierta, setAbierta] = useState<string>()
  const tiene = (...nombres: string[]) => h.rasgos.some((r) => nombres.includes(r.nombre)) || h.resolucion.dotes.some((d) => nombres.includes(d._nombre))
  const hab = (clave: string) => h.habilidades.find((s) => s.clave === clave)!
  const tirarHab = (clave: string, etiqueta: string) => {
    const s = hab(clave)
    tirar({ etiqueta, formula: `1d20${conSigno(s.bono + h.penalizacionD20)}${s.dados.map((d) => `+${d}`).join('')}`, d20: true, ventaja, personaje: nombrePj })
  }

  const speed = h.velocidad.andar
  const astuto = tiene('Cunning Action')
  const monje = tiene("Monk's Focus")
  const ataques = tiene('Three Extra Attacks') ? 4 : tiene('Two Extra Attacks') ? 3 : tiene('Extra Attack') ? 2 : 1
  // Grapple y Shove: DC 8 + STR + PB (el monje puede usar DEX con Dexterous Attacks)
  const carAgarre = tiene('Martial Arts') && h.car.dex.mod > h.car.str.mod ? 'dex' : 'str'
  const dcAgarre = 8 + h.car[carAgarre].mod + h.pb
  const armasLigeras = h.ataques.some((a) => a.propiedades.includes('L'))
  const bonus = (si: boolean): Tipo[] => (si ? ['Action', 'Bonus Action'] : ['Action'])
  const porQue = [astuto && 'Cunning Action', monje && "Monk's Focus"].filter(Boolean).join(' o ')

  const acciones: Accion[] = [
    {
      nombre: 'Attack', tipo: ['Action'],
      texto: 'Atacas con un arma o haces un Unarmed Strike; puedes moverte entre ataques. Las tiradas están en «Ataques».',
      datos: ataques > 1 ? `${ataques} ataques (Extra Attack)` : '1 ataque',
    },
    {
      nombre: 'Grapple / Shove', tipo: ['Action'],
      texto: 'Sustituye un ataque del Unarmed Strike. El objetivo, como mucho una talla mayor que tú, hace una salvación de STR o DEX (la que elija). Si falla queda Grappled, o lo empujas 5 ft o lo derribas (Prone). Mientras agarras, tu Speed se reduce a la mitad salvo que la criatura sea dos tallas menor o más.',
      datos: <>DC <b>{dcAgarre}</b> <span className="sutil">({ABREV[carAgarre]})</span></>,
    },
    {
      nombre: 'Escapar de un agarre', tipo: ['Action'],
      texto: 'Prueba de Athletics o Acrobatics contra la DC del agarre.',
      habilidades: ['athletics', 'acrobatics'],
    },
    {
      nombre: 'Dash', tipo: bonus(astuto || monje),
      texto: `Ganas movimiento extra igual a tu Speed este turno.${astuto || monje ? ` Como Bonus Action gracias a ${porQue}${monje ? ' (Step of the Wind)' : ''}.` : ''}`,
      datos: `+${speed} ft · ${2 * speed} ft en total`,
    },
    {
      nombre: 'Disengage', tipo: bonus(astuto || monje),
      texto: `Tu movimiento no provoca Opportunity Attacks el resto del turno.${astuto || monje ? ` Como Bonus Action gracias a ${porQue}${monje ? ' (Patient Defense)' : ''}.` : ''}`,
    },
    {
      nombre: 'Dodge', tipo: bonus(monje),
      texto: `Hasta tu siguiente turno, los ataques que veas contra ti tienen desventaja y tus salvaciones de DEX tienen ventaja. Se pierde si quedas Incapacitated o tu Speed es 0.${monje ? ' Como Bonus Action con Patient Defense (1 Focus Point).' : ''}`,
    },
    {
      nombre: 'Hide', tipo: bonus(astuto),
      texto: `Con cobertura total o tres cuartos, o en una zona muy oscura, y fuera de la vista de los enemigos. Si superas la DC quedas Invisible hasta que hagas ruido, ataques o te encuentren; quien te busque tiene que superar tu resultado con Perception.${astuto ? ' Como Bonus Action gracias a Cunning Action.' : ''}`,
      datos: 'DC 15',
      habilidades: ['stealth'],
    },
    { nombre: 'Help', tipo: ['Action'], texto: 'Das ventaja a un aliado en su próxima prueba con una habilidad o herramienta que domines, o en su próximo ataque contra un enemigo a 5 ft de ti.' },
    { nombre: 'Ready', tipo: ['Action', 'Reaction'], texto: 'Preparas una acción o un movimiento para un desencadenante que elijas, y reaccionas con tu Reaction cuando ocurre. Un conjuro preparado así requiere concentración.' },
    { nombre: 'Opportunity Attack', tipo: ['Reaction'], texto: 'Cuando una criatura que ves sale de tu alcance, haces un ataque cuerpo a cuerpo contra ella.' },
    ...(armasLigeras
      ? [{
          nombre: 'Atacar con dos armas', tipo: ['Bonus Action'] as Tipo[],
          texto: 'Tras atacar con un arma Light, puedes atacar con otra arma Light. No sumas tu modificador al daño (salvo que sea negativo o tengas Two-Weapon Fighting).',
        }]
      : []),
    {
      nombre: 'Saltar', tipo: ['Movimiento'],
      texto: 'Con 10 ft de carrerilla; sin carrerilla, la mitad. Cada pie saltado gasta un pie de movimiento.',
      datos: `Largo ${h.car.str.valor} ft · Alto ${Math.max(0, 3 + h.car.str.mod)} ft`,
    },
  ]

  return (
    <section className="acciones">
      <h3>Acciones</h3>
      <ul className="lista-acciones">
        {acciones.map((a) => (
          <li key={a.nombre} className="accion">
            <div className="accion-fila">
              <span className="accion-nombre">
                <b>{a.nombre}</b>
                {a.tipo.map((t) => <span key={t} className={`tipo-accion tipo-${t.split(' ')[0].toLowerCase()}`}>{t === 'Bonus Action' ? 'Bonus' : t}</span>)}
              </span>
              <span className="accion-datos">
                {a.datos}
                {a.habilidades?.map((k) => (
                  <button key={k} className="boton-tirada" onClick={() => tirarHab(k, `${a.nombre}: ${hab(k).nombre}`)}>
                    {hab(k).nombre} {conSigno(hab(k).bono)}{hab(k).dados.length ? ` +${hab(k).dados.join('+')}` : ''}
                  </button>
                ))}
              </span>
              <button
                className={`boton-ayuda ${abierta === a.nombre ? 'activo' : ''}`}
                aria-expanded={abierta === a.nombre}
                aria-label={`Qué es ${a.nombre}`}
                onClick={() => setAbierta(abierta === a.nombre ? undefined : a.nombre)}
              >
                ?
              </button>
            </div>
            {abierta === a.nombre && <p className="accion-texto">{a.texto}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
