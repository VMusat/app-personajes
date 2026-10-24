// Acciones de combate de las reglas (Dash, Hide, Grapple...) con lo que cada una supone para este personaje:
// tiradas de habilidad, DC de Grapple y Shove, movimiento extra, número de ataques, saltos...
import type { ReactNode } from 'react'
import { useEstado } from '../../estado/store'
import type { Hoja } from '../../motor/derivar'
import { ABREV, conSigno } from '../glosario'

type Tipo = 'Action' | 'Bonus Action' | 'Reaction' | 'Movimiento' | 'Sin acción'

interface Accion {
  nombre: string
  tipo: Tipo[]
  texto: string
  /** Lo que significa para este personaje (valores calculados). */
  datos?: ReactNode
  /** Habilidades que se pueden tirar. */
  habilidades?: string[]
}

export function Acciones({ h, nombrePj, ventaja }: { h: Hoja; nombrePj: string; ventaja?: 'ventaja' | 'desventaja' }) {
  const tirar = useEstado((s) => s.tirar)
  const tiene = (...nombres: string[]) => h.rasgos.some((r) => nombres.includes(r.nombre)) || h.resolucion.dotes.some((d) => nombres.includes(d._nombre))
  const hab = (clave: string) => h.habilidades.find((s) => s.clave === clave)!
  const tirarHab = (clave: string, etiqueta?: string) => {
    const s = hab(clave)
    tirar({ etiqueta: etiqueta ?? s.nombre, formula: `1d20${conSigno(s.bono + h.penalizacionD20)}${s.dados.map((d) => `+${d}`).join('')}`, d20: true, ventaja, personaje: nombrePj })
  }

  const speed = h.velocidad.andar
  const astuto = tiene('Cunning Action')
  const monje = tiene("Monk's Focus")
  const ataques = tiene('Three Extra Attacks') ? 4 : tiene('Two Extra Attacks') ? 3 : tiene('Extra Attack') ? 2 : 1
  // Grapple y Shove: DC 8 + STR + PB (el monje puede usar DEX con Dexterous Attacks)
  const carAgarre = tiene('Martial Arts') && h.car.dex.mod > h.car.str.mod ? 'dex' : 'str'
  const dcAgarre = 8 + h.car[carAgarre].mod + h.pb
  const armasLigeras = h.ataques.filter((a) => a.propiedades.includes('L')).length
  const extraBonus = (motivo: string) => <span className="insignia">Bonus Action: {motivo}</span>

  const acciones: Accion[] = [
    {
      nombre: 'Attack', tipo: ['Action'],
      texto: 'Atacas con un arma o haces un Unarmed Strike. Puedes moverte entre ataques.',
      datos: <>{ataques} {ataques > 1 ? 'ataques' : 'ataque'} por acción{ataques > 1 ? ' (Extra Attack)' : ''}. Tira desde «Ataques».</>,
    },
    {
      nombre: 'Grapple / Shove', tipo: ['Action'],
      texto: 'Opción del Unarmed Strike (sustituye un ataque). El objetivo, como mucho una talla mayor que tú, hace una salvación de STR o DEX (la que elija). Si falla: queda Grappled, o lo empujas 5 ft o lo derribas (Prone).',
      datos: <>DC <b>{dcAgarre}</b> (8 + {ABREV[carAgarre]} + PB). Mientras agarras, tu Speed se reduce a la mitad salvo que la criatura sea al menos dos tallas menor.</>,
    },
    {
      nombre: 'Escapar de un agarre', tipo: ['Action'],
      texto: 'Prueba de Athletics o Acrobatics contra la DC del agarre.',
      habilidades: ['athletics', 'acrobatics'],
    },
    {
      nombre: 'Dash', tipo: astuto || monje ? ['Action', 'Bonus Action'] : ['Action'],
      texto: 'Ganas movimiento extra igual a tu Speed este turno.',
      datos: <>+{speed} ft (en total {2 * speed} ft este turno){astuto && <> {extraBonus('Cunning Action')}</>}{monje && <> {extraBonus('Step of the Wind')}</>}</>,
    },
    {
      nombre: 'Disengage', tipo: astuto || monje ? ['Action', 'Bonus Action'] : ['Action'],
      texto: 'Tu movimiento no provoca Opportunity Attacks durante el resto del turno.',
      datos: astuto || monje ? <>{astuto && extraBonus('Cunning Action')} {monje && extraBonus('Patient Defense')}</> : undefined,
    },
    {
      nombre: 'Dodge', tipo: monje ? ['Action', 'Bonus Action'] : ['Action'],
      texto: 'Hasta tu siguiente turno, los ataques que veas contra ti tienen desventaja y tus salvaciones de DEX tienen ventaja. Se pierde si quedas Incapacitated o tu Speed es 0.',
      datos: monje ? extraBonus('Patient Defense (1 Focus Point)') : undefined,
    },
    {
      nombre: 'Hide', tipo: astuto ? ['Action', 'Bonus Action'] : ['Action'],
      texto: 'Con cobertura total o tres cuartos, o en una zona muy oscura, y fuera de la vista de los enemigos: prueba de Stealth DC 15. Si la superas quedas Invisible hasta que hagas ruido, ataques o te encuentren. La prueba de Perception de quien te busque tiene que superar tu resultado.',
      habilidades: ['stealth'],
      datos: astuto ? extraBonus('Cunning Action') : undefined,
    },
    {
      nombre: 'Help', tipo: ['Action'],
      texto: 'Das ventaja a un aliado en su próxima prueba con una habilidad o herramienta que domines, o en su próximo ataque contra un enemigo a 5 ft de ti.',
    },
    {
      nombre: 'Influence', tipo: ['Action'],
      texto: 'Intentas convencer a una criatura que no está decidida. El DM pide la habilidad según cómo lo hagas.',
      habilidades: ['persuasion', 'deception', 'intimidation', 'performance', 'animal handling'],
    },
    {
      nombre: 'Search', tipo: ['Action'],
      texto: 'Buscas algo que no es evidente.',
      habilidades: ['perception', 'insight', 'medicine', 'survival'],
      datos: <>Percepción pasiva {h.percepcionPasiva}</>,
    },
    {
      nombre: 'Study', tipo: ['Action'],
      texto: 'Recuerdas o analizas información: un libro, un símbolo, una criatura, un mecanismo.',
      habilidades: ['arcana', 'history', 'investigation', 'nature', 'religion'],
    },
    {
      nombre: 'Magic', tipo: ['Action'],
      texto: 'Lanzas un conjuro de 1 acción, usas un objeto mágico o un rasgo mágico.',
      datos: h.lanzamiento.length ? <>{h.lanzamiento.map((l) => `${l.nombre}: DC ${l.cd}, ataque ${conSigno(l.ataque)}`).join(' · ')}</> : undefined,
    },
    { nombre: 'Ready', tipo: ['Action', 'Reaction'], texto: 'Preparas una acción o un movimiento para un desencadenante que elijas; reaccionas con tu Reaction cuando ocurre. Un conjuro preparado así requiere concentración.' },
    { nombre: 'Utilize', tipo: ['Action'], texto: 'Usas un objeto que no es mágico y requiere una acción: abrir una cerradura, beber una poción, encender una antorcha...' },
    {
      nombre: 'Opportunity Attack', tipo: ['Reaction'],
      texto: 'Cuando una criatura que ves sale de tu alcance, haces un ataque cuerpo a cuerpo contra ella.',
    },
    ...(armasLigeras
      ? [{
          nombre: 'Atacar con dos armas', tipo: ['Bonus Action'] as Tipo[],
          texto: 'Tras atacar con un arma Light, puedes atacar con otra arma Light. No sumas tu modificador al daño (salvo que sea negativo o tengas Two-Weapon Fighting).',
        }]
      : []),
    {
      nombre: 'Saltar', tipo: ['Movimiento'],
      texto: 'Con 10 ft de carrerilla; sin carrerilla, la mitad. Cada pie saltado gasta un pie de movimiento.',
      datos: <>Longitud {h.car.str.valor} ft · Altura {Math.max(0, 3 + h.car.str.mod)} ft</>,
    },
    {
      nombre: 'Aguantar la respiración', tipo: ['Sin acción'],
      texto: 'Después, empiezas a asfixiarte.',
      // 1 + CON minutos, mínimo 30 segundos
      datos: <>{1 + h.car.con.mod >= 1 ? `${1 + h.car.con.mod} minuto${1 + h.car.con.mod > 1 ? 's' : ''}` : '30 segundos'}</>,
    },
  ]

  return (
    <section className="acciones">
      <h3>Acciones</h3>
      <p className="sutil">Lo que puedes hacer en tu turno, con tus valores. Las tiradas usan la ventaja o desventaja elegida en «Ataques».</p>
      <div className="lista-acciones">
        {acciones.map((a) => (
          <div key={a.nombre} className="accion">
            <div className="accion-cabecera">
              <b>{a.nombre}</b>
              {a.tipo.map((t) => <span key={t} className="insignia tipo-accion">{t}</span>)}
            </div>
            <p className="accion-texto">{a.texto}</p>
            {a.datos && <p className="accion-datos">{a.datos}</p>}
            {a.habilidades && (
              <div className="fila accion-tiradas">
                {a.habilidades.map((k) => (
                  <button key={k} className="boton-tirada" onClick={() => tirarHab(k, `${a.nombre}: ${hab(k).nombre}`)}>
                    {hab(k).nombre} {conSigno(hab(k).bono)}{hab(k).dados.length ? ` +${hab(k).dados.join('+')}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
