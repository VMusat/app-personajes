// Elecciones y efectos de los rasgos de clase que 5etools solo describe en texto.
// La clave es «Clase|Subclase|nivel|Nombre» (Subclase vacía para rasgos de clase; nombres en inglés, como en 5etools).
// Lo que 5etools ya trae estructurado (subclase, dotes, invocaciones, conjuros de subclase, opciones «options»)
// lo procesa el motor directamente y no aparece aquí.
//
// Un test recorre todos los rasgos de las clases permitidas y falla si un rasgo que menciona una elección
// no está aquí ni lo cubren los datos estructurados: así no se queda nada atrás al subir de nivel.
import type { Efecto, Formula } from './efectos'

export type TipoEleccion =
  | 'habilidad'
  | 'pericia'
  | 'herramienta'
  | 'idioma'
  | 'maestria'
  | 'resistencia'
  | 'conjuro'
  | 'salvacion'
  | 'opcion'
  | 'texto'
  | 'plano'

export interface EleccionManual {
  id: string
  tipo: TipoEleccion
  etiqueta: string
  n: Formula
  /** Opciones posibles. Para habilidades: claves en minúsculas; «competentes» = las que ya domina. */
  de?: string[] | 'competentes' | 'todas' | 'artesano' | 'estandar'
  /** Para conjuros: filtro con el formato de 5etools («level=0;1|class=Wizard|school=A»). */
  filtro?: string
  /** Efectos de cada opción (tipo «opcion»). */
  opciones?: Record<string, Efecto[]>
  /** Cuándo puede cambiarse la elección desde la hoja. */
  cambia?: 'largo' | 'corto' | 'nivel'
  /** Para conjuros elegidos: cómo se obtienen. */
  comoConjuro?: { siempre?: boolean; usos?: Formula; recarga?: 'largo' | 'corto'; libro?: boolean; trucoExtra?: boolean }
}

export interface RasgoManual {
  elecciones?: EleccionManual[]
  efectos?: Efecto[]
  /** El rasgo menciona elecciones, pero se resuelven en juego (cada vez que se usa) o los cubren datos estructurados. */
  sinEleccion?: string
}

const DANOS_DRACONICOS = ['acid', 'cold', 'fire', 'lightning', 'poison']
const DANOS_ELEMENTALES = ['acid', 'cold', 'fire', 'lightning', 'thunder']
const pericia = (n: number): EleccionManual => ({ id: 'pericia', tipo: 'pericia', etiqueta: 'Expertise', n, de: 'competentes' })
const maestria = (n: Formula): EleccionManual => ({ id: 'maestria', tipo: 'maestria', etiqueta: 'Weapon Mastery', n, cambia: 'largo' })
const asi = { sinEleccion: 'Dote o mejora de característica: la genera el motor' }
const boon = { sinEleccion: 'Don épico: lo genera el motor' }
const enJuego = (por = 'Se elige al usar el rasgo') => ({ sinEleccion: por })
const conjuroSub = { sinEleccion: 'Conjuros de subclase: additionalSpells estructurado' }

export const RASGOS_MANUALES: Record<string, RasgoManual> = {
  // ── Comunes a todas las clases
  ...Object.fromEntries(
    ['Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'].flatMap((c) => [
      ...[4, 6, 8, 10, 12, 14, 16].map((n) => [`${c}||${n}|Ability Score Improvement`, asi]),
      [`${c}||19|Epic Boon`, boon],
      [`${c}||3|${c} Subclass`, { sinEleccion: 'Subclase: la genera el motor' }],
      [`${c}||1|Spellcasting`, { sinEleccion: 'Trucos y conjuros: progresión de la clase' }],
    ]),
  ),

  // ── Artificiero
  'Artificer||1|Tinker\'s Magic': enJuego('Objeto que se crea al usar el rasgo'),
  'Artificer||2|Replicate Magic Item': {
    elecciones: [{ id: 'planos', tipo: 'plano', etiqueta: 'Plans Known', n: 'col:Plans_Known', cambia: 'nivel' }],
  },
  'Artificer||6|Magic Item Tinker': enJuego(),
  'Artificer||11|Spell-Storing Item': enJuego('Conjuro que se guarda tras un descanso largo'),
  'Artificer|Alchemist|3|Tools of the Trade': {
    efectos: [
      { tipo: 'competencia', categoria: 'herramienta', valor: "alchemist's supplies" },
      { tipo: 'competencia', categoria: 'herramienta', valor: 'herbalism kit' },
    ],
    sinEleccion: 'Solo hay elección si ya tenía las herramientas; se resuelve en el paso de herramientas duplicadas',
  },
  'Artificer|Alchemist|3|Alchemist Spells': conjuroSub,
  'Artificer|Alchemist|3|Experimental Elixir': enJuego('Elixires aleatorios tras cada descanso largo'),
  'Artificer|Alchemist|15|Chemical Mastery': { efectos: [{ tipo: 'resistencia', valor: 'acid' }, { tipo: 'resistencia', valor: 'poison' }, { tipo: 'inmunidadCondicion', valor: 'poisoned' }] },
  'Artificer|Armorer|3|Tools of the Trade': {
    efectos: [
      { tipo: 'competencia', categoria: 'armadura', valor: 'heavy' },
      { tipo: 'competencia', categoria: 'herramienta', valor: "smith's tools" },
    ],
    sinEleccion: 'Solo hay elección si ya tenía las herramientas',
  },
  'Artificer|Armorer|3|Armorer Spells': conjuroSub,
  'Artificer|Armorer|3|Armor Model': {
    elecciones: [{ id: 'modelo', tipo: 'opcion', etiqueta: 'Armor Model', n: 1, de: ['Dreadnaught', 'Guardian', 'Infiltrator'], cambia: 'corto' }],
  },
  'Artificer|Armorer|9|Improved Armorer': { sinEleccion: 'El plano extra de armadura entra en «Plans Known»' },
  'Artificer|Artillerist|3|Tools of the Trade': {
    efectos: [
      { tipo: 'competencia', categoria: 'arma', valor: 'martial ranged' },
      { tipo: 'competencia', categoria: 'herramienta', valor: "woodcarver's tools" },
    ],
    sinEleccion: 'Solo hay elección si ya tenía las herramientas',
  },
  'Artificer|Artillerist|3|Artillerist Spells': conjuroSub,
  'Artificer|Battle Smith|3|Tools of the Trade': {
    efectos: [{ tipo: 'competencia', categoria: 'herramienta', valor: "smith's tools" }],
    sinEleccion: 'Solo hay elección si ya tenía las herramientas',
  },
  'Artificer|Battle Smith|3|Battle Smith Spells': conjuroSub,
  'Artificer|Battle Smith|3|Battle Ready': { efectos: [{ tipo: 'competencia', categoria: 'arma', valor: 'martial' }] },
  'Artificer|Battle Smith|9|Arcane Jolt': enJuego(),
  'Artificer|Cartographer|3|Tools of the Trade': {
    efectos: [
      { tipo: 'competencia', categoria: 'herramienta', valor: "calligrapher's supplies" },
      { tipo: 'competencia', categoria: 'herramienta', valor: "cartographer's tools" },
    ],
    sinEleccion: 'Solo hay elección si ya tenía las herramientas',
  },
  'Artificer|Cartographer|3|Cartographer Spells': conjuroSub,
  'Artificer|Cartographer|9|Ingenious Movement': enJuego(),

  // ── Bárbaro
  'Barbarian||1|Rage': enJuego(),
  'Barbarian||1|Weapon Mastery': { elecciones: [maestria('col:Weapon_Mastery')] },
  'Barbarian||3|Primal Knowledge': {
    elecciones: [{ id: 'habilidad', tipo: 'habilidad', etiqueta: 'Primal Knowledge', n: 1, de: ['animal handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] }],
  },
  'Barbarian||9|Brutal Strike': enJuego(),
  'Barbarian|Berserker|14|Intimidating Presence': enJuego(),
  'Barbarian|Wild Heart|3|Rage of the Wilds': enJuego('Se elige al entrar en Furia'),
  'Barbarian|Wild Heart|6|Aspect of the Wilds': {
    elecciones: [
      {
        id: 'aspecto', tipo: 'opcion', etiqueta: 'Aspect of the Wilds', n: 1, de: ['Owl', 'Panther', 'Salmon'], cambia: 'largo',
        opciones: {
          Owl: [{ tipo: 'sentido', nombre: 'Darkvision', valor: 60 }],
          Panther: [{ tipo: 'velocidad', modo: 'trepar', valor: 'velocidad' }],
          Salmon: [{ tipo: 'velocidad', modo: 'nado', valor: 'velocidad' }],
        },
      },
    ],
  },
  'Barbarian|Wild Heart|14|Power of the Wilds': enJuego('Se elige al entrar en Furia'),
  'Barbarian|World Tree|3|Vitality of the Tree': enJuego(),
  'Barbarian|World Tree|14|Travel Along the Tree': enJuego(),
  'Barbarian|Zealot|3|Divine Fury': enJuego(),
  'Barbarian|Zealot|10|Zealous Presence': enJuego(),
  'Barbarian|Zealot|14|Rage of the Gods': enJuego(),

  // ── Bardo
  'Bard||2|Expertise': { elecciones: [pericia(2)] },
  'Bard||9|Expertise': { elecciones: [pericia(2)] },
  'Bard||10|Magical Secrets': { sinEleccion: 'Amplía la lista de conjuros del bardo (additionalSpells expanded)' },
  'Bard||20|Words of Creation': { sinEleccion: 'Conjuros siempre preparados: additionalSpells de la clase' },
  'Bard|Dance|6|Inspiring Movement': enJuego(),
  'Bard|Glamour|3|Beguiling Magic': conjuroSub,
  'Bard|Glamour|3|Mantle of Inspiration': enJuego(),
  'Bard|Glamour|6|Mantle of Majesty': conjuroSub,
  'Bard|Lore|3|Bonus Proficiencies': { elecciones: [{ id: 'habilidades', tipo: 'habilidad', etiqueta: 'Bonus Proficiencies', n: 3, de: 'todas' }] },
  'Bard|Lore|3|Cutting Words': enJuego(),
  'Bard|Lore|6|Magical Discoveries': conjuroSub,
  'Bard|Valor|3|Martial Training': {
    efectos: [
      { tipo: 'competencia', categoria: 'arma', valor: 'martial' },
      { tipo: 'competencia', categoria: 'armadura', valor: 'medium' },
      { tipo: 'competencia', categoria: 'armadura', valor: 'shield' },
    ],
  },
  'Bard|Moon|3|Primal Lore': {
    efectos: [{ tipo: 'competencia', categoria: 'idioma', valor: 'Druidic' }],
    elecciones: [{ id: 'habilidad', tipo: 'habilidad', etiqueta: 'Primal Lore', n: 1, de: ['animal handling', 'insight', 'medicine', 'nature', 'perception', 'survival'] }],
    sinEleccion: 'El truco de druida está en additionalSpells',
  },
  'Bard|Moon|6|Blessing of Moonlight': conjuroSub,

  // ── Clérigo
  'Cleric||1|Divine Order': { sinEleccion: 'Opciones estructuradas (Protector o Thaumaturge)' },
  'Cleric||1|Protector': {
    efectos: [
      { tipo: 'competencia', categoria: 'arma', valor: 'martial' },
      { tipo: 'competencia', categoria: 'armadura', valor: 'heavy' },
    ],
  },
  'Cleric||1|Thaumaturge': {
    efectos: [
      { tipo: 'trucosExtra', clase: 'Cleric', valor: 1 },
      { tipo: 'bono', objetivo: 'habilidad:arcana', valor: 'max(1,wis)' },
      { tipo: 'bono', objetivo: 'habilidad:religion', valor: 'max(1,wis)' },
    ],
  },
  'Cleric||2|Channel Divinity': enJuego(),
  'Cleric||2|Turn Undead': enJuego(),
  'Cleric||7|Blessed Strikes': { sinEleccion: 'Opciones estructuradas (Divine Strike o Potent Spellcasting)' },
  'Cleric||10|Divine Intervention': enJuego(),
  'Cleric||20|Greater Divine Intervention': enJuego(),
  'Cleric|Life|3|Life Domain': { sinEleccion: 'Texto introductorio' },
  'Cleric|Life|3|Life Domain Spells': conjuroSub,
  'Cleric|Life|3|Preserve Life': enJuego(),
  'Cleric|Light|3|Light Domain Spells': conjuroSub,
  'Cleric|Light|3|Radiance of the Dawn': enJuego(),
  'Cleric|Trickery|3|Trickery Domain Spells': conjuroSub,
  'Cleric|Trickery|3|Blessing of the Trickster': enJuego(),
  'Cleric|Trickery|17|Improved Duplicity': enJuego(),
  'Cleric|War|3|War Domain Spells': conjuroSub,
  'Cleric|War|17|Avatar of Battle': {
    efectos: [
      { tipo: 'resistencia', valor: 'bludgeoning' },
      { tipo: 'resistencia', valor: 'piercing' },
      { tipo: 'resistencia', valor: 'slashing' },
    ],
  },
  'Cleric|Knowledge|3|Blessings of Knowledge': {
    elecciones: [
      { id: 'herramienta', tipo: 'herramienta', etiqueta: "Artisan's Tools", n: 1, de: 'artesano' },
      { id: 'habilidades', tipo: 'pericia', etiqueta: 'Blessings of Knowledge (competencia y pericia)', n: 2, de: ['arcana', 'history', 'nature', 'religion'] },
    ],
  },
  'Cleric|Knowledge|3|Knowledge Domain Spells': conjuroSub,
  'Cleric|Knowledge|3|Mind Magic': enJuego(),
  'Cleric|Knowledge|6|Unfettered Mind': {
    efectos: [
      { tipo: 'sentido', nombre: 'Telepathy', valor: 60 },
      { tipo: 'competencia', categoria: 'salvacion', valor: 'int' },
    ],
    sinEleccion: 'Si ya tenía la salvación de INT, se elige otra en la hoja',
  },

  // ── Druida
  'Druid||1|Druidic': { efectos: [{ tipo: 'competencia', categoria: 'idioma', valor: 'Druidic' }] },
  'Druid||1|Primal Order': { sinEleccion: 'Opciones estructuradas (Magician o Warden)' },
  'Druid||1|Magician': {
    efectos: [
      { tipo: 'trucosExtra', clase: 'Druid', valor: 1 },
      { tipo: 'bono', objetivo: 'habilidad:arcana', valor: 'max(1,wis)' },
      { tipo: 'bono', objetivo: 'habilidad:nature', valor: 'max(1,wis)' },
    ],
  },
  'Druid||1|Warden': {
    efectos: [
      { tipo: 'competencia', categoria: 'arma', valor: 'martial' },
      { tipo: 'competencia', categoria: 'armadura', valor: 'medium' },
    ],
  },
  'Druid||2|Wild Shape': enJuego('Las formas conocidas se anotan en la hoja'),
  'Druid||7|Elemental Fury': { sinEleccion: 'Opciones estructuradas (Potent Spellcasting o Primal Strike)' },
  'Druid||7|Primal Strike': enJuego(),
  'Druid||20|Archdruid': enJuego(),
  'Druid|Land|3|Circle of the Land Spells': { sinEleccion: 'Variante de additionalSpells (tipo de tierra), cambia en cada descanso largo' },
  'Druid|Land|3|Land\'s Aid': enJuego(),
  'Druid|Land|6|Natural Recovery': enJuego(),
  'Druid|Land|10|Nature\'s Ward': { efectos: [{ tipo: 'inmunidadCondicion', valor: 'poisoned' }], sinEleccion: 'La resistencia depende del tipo de tierra elegido' },
  'Druid|Moon|3|Circle of the Moon Spells': conjuroSub,
  'Druid|Sea|3|Circle of the Sea Spells': conjuroSub,
  'Druid|Sea|3|Wrath of the Sea': enJuego(),
  'Druid|Sea|10|Stormborn': enJuego('Solo mientras Wrath of the Sea está activo'),
  'Druid|Stars|3|Starry Form': enJuego(),
  'Druid|Stars|14|Full of Stars': enJuego('Solo en Starry Form'),

  // ── Guerrero
  'Fighter||1|Fighting Style': { sinEleccion: 'featProgression (dote de estilo de combate)' },
  'Fighter||1|Weapon Mastery': { elecciones: [maestria('col:Weapon_Mastery')] },
  'Fighter|Battle Master|3|Combat Superiority': { sinEleccion: 'optionalfeatureProgression (maniobras)' },
  'Fighter|Battle Master|3|Maneuver Options': { sinEleccion: 'optionalfeatureProgression (maniobras)' },
  'Fighter|Battle Master|3|Student of War': {
    elecciones: [
      { id: 'herramienta', tipo: 'herramienta', etiqueta: "Artisan's Tools", n: 1, de: 'artesano' },
      { id: 'habilidad', tipo: 'habilidad', etiqueta: 'Student of War', n: 1, de: ['acrobatics', 'animal handling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'] },
    ],
  },
  'Fighter|Battle Master|7|Know Your Enemy': enJuego(),
  'Fighter|Champion|7|Additional Fighting Style': { sinEleccion: 'featProgression de la subclase' },
  'Fighter|Eldritch Knight|3|Spellcasting': { sinEleccion: 'Progresión de conjuros de la subclase' },
  'Fighter|Eldritch Knight|3|War Bond': enJuego(),
  'Fighter|Eldritch Knight|10|Eldritch Strike': enJuego(),
  'Fighter|Psi Warrior|3|Telekinetic Movement': enJuego(),
  'Fighter|Psi Warrior|10|Guarded Mind': { efectos: [{ tipo: 'resistencia', valor: 'psychic' }] },
  'Fighter|Psi Warrior|15|Bulwark of Force': enJuego(),
  'Fighter|Psi Warrior|18|Telekinetic Master': conjuroSub,
  'Fighter|Banneret|3|Knightly Envoy': {
    elecciones: [
      { id: 'idioma', tipo: 'idioma', etiqueta: 'Polyglot', n: 1, de: 'estandar' },
      { id: 'habilidad', tipo: 'habilidad', etiqueta: 'Knightly Envoy', n: 1, de: ['insight', 'intimidation', 'performance', 'persuasion'] },
    ],
    sinEleccion: 'Comprehend Languages como ritual: additionalSpells',
  },
  'Fighter|Banneret|3|Group Recovery': enJuego(),
  'Fighter|Banneret|10|Rallying Surge': enJuego(),

  // ── Monje
  'Monk||3|Deflect Attacks': enJuego(),
  'Monk||10|Heightened Focus': enJuego(),
  'Monk||18|Superior Defense': enJuego(),
  'Monk|Mercy|3|Implements of Mercy': {
    efectos: [
      { tipo: 'competencia', categoria: 'habilidad', valor: 'insight' },
      { tipo: 'competencia', categoria: 'habilidad', valor: 'medicine' },
      { tipo: 'competencia', categoria: 'herramienta', valor: 'herbalism kit' },
    ],
  },
  'Monk|Shadow|3|Shadowy Figments': conjuroSub,
  'Monk|Elements|3|Manipulate Elements': conjuroSub,
  'Monk|Elements|6|Elemental Burst': enJuego(),
  'Monk|Elements|17|Elemental Epitome': enJuego(),

  // ── Paladín
  'Paladin||1|Weapon Mastery': { elecciones: [maestria(2)] },
  'Paladin||2|Fighting Style': { sinEleccion: 'featProgression (FS o FS:P, incluye Blessed Warrior)' },
  'Paladin||2|Paladin\'s Smite': {
    sinEleccion: 'Divine Smite siempre preparado: additionalSpells de la clase',
    efectos: [{ tipo: 'conjuro', conjuro: 'divine smite|xphb', siempre: true, usos: 1, recarga: 'largo' }],
  },
  'Paladin||3|Channel Divinity': enJuego(),
  'Paladin||3|Divine Sense': enJuego(),
  'Paladin||5|Faithful Steed': {
    sinEleccion: 'Find Steed siempre preparado: additionalSpells de la clase',
    efectos: [{ tipo: 'conjuro', conjuro: 'find steed|xphb', siempre: true, usos: 1, recarga: 'largo' }],
  },
  'Paladin||6|Aura of Protection': {
    efectos: [{ tipo: 'bono', objetivo: 'salvaciones', valor: 'max(1,cha)', condicion: 'Aura of Protection' }],
  },
  'Paladin|Devotion|3|Oath of Devotion Spells': conjuroSub,
  'Paladin|Glory|3|Oath of Glory Spells': conjuroSub,
  'Paladin|Glory|3|Inspiring Smite': enJuego(),
  'Paladin|Ancients|3|Oath of the Ancients Spells': conjuroSub,
  'Paladin|Ancients|3|Nature\'s Wrath': enJuego(),
  'Paladin|Ancients|7|Aura of Warding': {
    efectos: [
      { tipo: 'resistencia', valor: 'necrotic' },
      { tipo: 'resistencia', valor: 'psychic' },
      { tipo: 'resistencia', valor: 'radiant' },
    ],
  },
  'Paladin|Vengeance|3|Oath of Vengeance Spells': conjuroSub,
  'Paladin|Noble Genies|3|Genie Spells': conjuroSub,
  'Paladin|Noble Genies|3|Djinni\'s Escape': enJuego(),
  'Paladin|Noble Genies|3|Marid\'s Surge': enJuego(),
  'Paladin|Noble Genies|3|Genie\'s Splendor': {
    efectos: [{ tipo: 'caBase', nombre: "Genie's Splendor", formula: '10+dex+cha', sinArmadura: true, escudo: true }],
    elecciones: [{ id: 'habilidad', tipo: 'habilidad', etiqueta: "Genie's Splendor", n: 1, de: ['acrobatics', 'intimidation', 'performance', 'persuasion'] }],
  },
  'Paladin|Noble Genies|7|Aura of Elemental Shielding': enJuego('El tipo de daño cambia al empezar cada turno'),

  // ── Explorador
  'Ranger||1|Favored Enemy': {
    efectos: [{ tipo: 'conjuro', conjuro: "hunter's mark|xphb", siempre: true, usos: 'col:Favored_Enemy', recarga: 'largo' }],
  },
  'Ranger||1|Weapon Mastery': { elecciones: [maestria(2)] },
  'Ranger||2|Deft Explorer': {
    elecciones: [pericia(1), { id: 'idiomas', tipo: 'idioma', etiqueta: 'Deft Explorer', n: 2, de: 'todas' }],
  },
  'Ranger||2|Fighting Style': { sinEleccion: 'featProgression (FS o FS:R, incluye Druidic Warrior)' },
  'Ranger||9|Expertise': { elecciones: [pericia(2)] },
  'Ranger|Beast Master|3|Primal Companion': {
    elecciones: [{ id: 'bestia', tipo: 'opcion', etiqueta: 'Primal Companion', n: 1, de: ['Beast of the Land', 'Beast of the Sea', 'Beast of the Sky'], cambia: 'largo' }],
  },
  'Ranger|Fey Wanderer|3|Fey Wanderer Spells': conjuroSub,
  'Ranger|Fey Wanderer|3|Otherworldly Glamour': {
    efectos: [{ tipo: 'bono', objetivo: 'prueba:cha', valor: 'max(1,wis)' }],
    elecciones: [{ id: 'habilidad', tipo: 'habilidad', etiqueta: 'Otherworldly Glamour', n: 1, de: ['deception', 'performance', 'persuasion'] }],
  },
  'Ranger|Fey Wanderer|15|Misty Wanderer': {
    efectos: [{ tipo: 'conjuro', conjuro: 'misty step|xphb', usos: 'max(1,wis)', recarga: 'largo' }],
  },
  'Ranger|Gloom Stalker|3|Gloom Stalker Spells': conjuroSub,
  'Ranger|Gloom Stalker|7|Iron Mind': {
    efectos: [{ tipo: 'competencia', categoria: 'salvacion', valor: 'wis' }],
    sinEleccion: 'Si ya tenía la salvación de WIS, se elige INT o CHA en la hoja',
  },
  'Ranger|Hunter|3|Hunter\'s Prey': {
    elecciones: [{ id: 'presa', tipo: 'opcion', etiqueta: "Hunter's Prey", n: 1, de: ['Colossus Slayer', 'Horde Breaker'], cambia: 'corto' }],
  },
  'Ranger|Hunter|3|Hunter\'s Lore': enJuego(),
  'Ranger|Hunter|7|Defensive Tactics': {
    elecciones: [{ id: 'tactica', tipo: 'opcion', etiqueta: 'Defensive Tactics', n: 1, de: ['Escape the Horde', 'Multiattack Defense'], cambia: 'corto' }],
  },
  'Ranger|Hunter|15|Superior Hunter\'s Defense': enJuego(),
  'Ranger|Winter Walker|3|Frigid Explorer': { efectos: [{ tipo: 'resistencia', valor: 'cold' }] },
  'Ranger|Winter Walker|3|Winter Walker Spells': conjuroSub,
  'Ranger|Winter Walker|7|Fortifying Soul': enJuego(),
  'Ranger|Winter Walker|15|Frozen Haunt': enJuego(),

  // ── Pícaro
  'Rogue||1|Expertise': { elecciones: [pericia(2)] },
  'Rogue||1|Sneak Attack': enJuego(),
  'Rogue||1|Thieves\' Cant': {
    efectos: [{ tipo: 'competencia', categoria: 'idioma', valor: "Thieves' Cant" }],
    elecciones: [{ id: 'idioma', tipo: 'idioma', etiqueta: "Thieves' Cant", n: 1, de: 'todas' }],
  },
  'Rogue||1|Weapon Mastery': { elecciones: [maestria(2)] },
  'Rogue||6|Expertise': { elecciones: [pericia(2)] },
  'Rogue||15|Slippery Mind': {
    efectos: [
      { tipo: 'competencia', categoria: 'salvacion', valor: 'wis' },
      { tipo: 'competencia', categoria: 'salvacion', valor: 'cha' },
    ],
  },
  'Rogue|Arcane Trickster|3|Spellcasting': { sinEleccion: 'Progresión de conjuros de la subclase' },
  'Rogue|Arcane Trickster|17|Spell Thief': enJuego(),
  'Rogue|Assassin|3|Assassin\'s Tools': {
    efectos: [
      { tipo: 'competencia', categoria: 'herramienta', valor: 'disguise kit' },
      { tipo: 'competencia', categoria: 'herramienta', valor: "poisoner's kit" },
    ],
  },
  'Rogue|Assassin|13|Envenom Weapons': enJuego(),
  'Rogue|Soulknife|3|Psychic Whispers': enJuego(),
  'Rogue|Scion of the Three|3|Dread Allegiance': {
    elecciones: [
      {
        id: 'alianza', tipo: 'opcion', etiqueta: 'Dread Allegiance', n: 1, cambia: 'largo',
        de: ['Tiranía (Bane)', 'Ira (Bhaal)', 'Aniquilación (Myrkul)'],
        opciones: {
          'Tiranía (Bane)': [{ tipo: 'resistencia', valor: 'psychic' }],
          'Ira (Bhaal)': [{ tipo: 'resistencia', valor: 'poison' }],
          'Aniquilación (Myrkul)': [{ tipo: 'resistencia', valor: 'necrotic' }],
        },
      },
    ],
    sinEleccion: 'El truco está en additionalSpells',
  },
  'Rogue|Scion of the Three|13|Aura of Malevolence': enJuego(),

  // ── Hechicero
  'Sorcerer||2|Metamagic': { sinEleccion: 'optionalfeatureProgression (metamagia)' },
  'Sorcerer||2|Metamagic Options': { sinEleccion: 'optionalfeatureProgression (metamagia)' },
  'Sorcerer||10|Metamagic': { sinEleccion: 'optionalfeatureProgression (metamagia)' },
  'Sorcerer||17|Metamagic': { sinEleccion: 'optionalfeatureProgression (metamagia)' },
  'Sorcerer|Aberrant|3|Psionic Spells': conjuroSub,
  'Sorcerer|Aberrant|3|Telepathic Speech': enJuego(),
  'Sorcerer|Aberrant|6|Psychic Defenses': { efectos: [{ tipo: 'resistencia', valor: 'psychic' }] },
  'Sorcerer|Aberrant|14|Revelation in Flesh': enJuego(),
  'Sorcerer|Clockwork|3|Clockwork Spells': conjuroSub,
  'Sorcerer|Clockwork|18|Clockwork Cavalcade': enJuego(),
  'Sorcerer|Draconic|3|Draconic Spells': conjuroSub,
  'Sorcerer|Draconic|3|Draconic Resilience': {
    efectos: [
      { tipo: 'bono', objetivo: 'pgPorNivel', valor: 1 },
      { tipo: 'caBase', nombre: 'Draconic Resilience', formula: '10+dex+cha', sinArmadura: true },
    ],
  },
  'Sorcerer|Draconic|6|Elemental Affinity': {
    elecciones: [
      {
        id: 'afinidad', tipo: 'resistencia', etiqueta: 'Elemental Affinity', n: 1, de: DANOS_DRACONICOS,
      },
    ],
  },
  'Sorcerer|Wild Magic|3|Wild Magic Surge': enJuego(),
  'Sorcerer|Wild Magic|18|Tamed Surge': enJuego(),
  'Sorcerer|Spellfire|3|Spellfire Burst': enJuego(),
  'Sorcerer|Spellfire|3|Spellfire Spells': conjuroSub,
  'Sorcerer|Spellfire|6|Absorb Spells': conjuroSub,

  // ── Brujo
  'Warlock||1|Eldritch Invocations': { sinEleccion: 'optionalfeatureProgression (invocaciones)' },
  'Warlock||1|Eldritch Invocation Options': { sinEleccion: 'optionalfeatureProgression (invocaciones)' },
  'Warlock||1|Pact Magic': { sinEleccion: 'Trucos y conjuros: progresión de la clase' },
  'Warlock||9|Contact Patron': { sinEleccion: 'additionalSpells de la clase' },
  'Warlock||11|Mystic Arcanum': { sinEleccion: 'spellsKnownProgressionFixedByLevel (arcano de nivel 6)' },
  'Warlock||13|Mystic Arcanum': { sinEleccion: 'spellsKnownProgressionFixedByLevel (arcano de nivel 7)' },
  'Warlock||15|Mystic Arcanum': { sinEleccion: 'spellsKnownProgressionFixedByLevel (arcano de nivel 8)' },
  'Warlock||17|Mystic Arcanum': { sinEleccion: 'spellsKnownProgressionFixedByLevel (arcano de nivel 9)' },
  'Warlock|Archfey|3|Archfey Patron': { sinEleccion: 'Texto introductorio' },
  'Warlock|Archfey|3|Archfey Spells': conjuroSub,
  'Warlock|Archfey|3|Steps of the Fey': conjuroSub,
  'Warlock|Celestial|3|Celestial Spells': conjuroSub,
  'Warlock|Celestial|6|Radiant Soul': { efectos: [{ tipo: 'resistencia', valor: 'radiant' }] },
  'Warlock|Celestial|10|Celestial Resilience': enJuego(),
  'Warlock|Celestial|14|Searing Vengeance': enJuego(),
  'Warlock|Fiend|3|Fiend Spells': conjuroSub,
  'Warlock|Fiend|10|Fiendish Resilience': {
    elecciones: [
      {
        id: 'resiliencia', tipo: 'resistencia', etiqueta: 'Fiendish Resilience', n: 1, cambia: 'corto',
        de: ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'],
      },
    ],
  },
  'Warlock|Great Old One|3|Great Old One Patron': { sinEleccion: 'Texto introductorio' },
  'Warlock|Great Old One|3|Great Old One Spells': conjuroSub,
  'Warlock|Great Old One|3|Awakened Mind': enJuego(),
  'Warlock|Great Old One|10|Eldritch Hex': conjuroSub,
  'Warlock|Great Old One|10|Thought Shield': { efectos: [{ tipo: 'resistencia', valor: 'psychic' }] },

  // ── Mago
  'Wizard||1|Arcane Recovery': enJuego(),
  'Wizard||1|Ritual Adept': enJuego(),
  'Wizard||2|Scholar': {
    elecciones: [{ id: 'pericia', tipo: 'pericia', etiqueta: 'Scholar', n: 1, de: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'] }],
  },
  'Wizard||5|Memorize Spell': enJuego(),
  'Wizard||18|Spell Mastery': {
    elecciones: [
      { id: 'n1', tipo: 'conjuro', etiqueta: 'Spell Mastery (nivel 1)', n: 1, filtro: 'level=1|libro', comoConjuro: { siempre: true }, cambia: 'largo' },
      { id: 'n2', tipo: 'conjuro', etiqueta: 'Spell Mastery (nivel 2)', n: 1, filtro: 'level=2|libro', comoConjuro: { siempre: true }, cambia: 'largo' },
    ],
  },
  'Wizard||20|Signature Spells': {
    elecciones: [{ id: 'firma', tipo: 'conjuro', etiqueta: 'Signature Spells', n: 2, filtro: 'level=3|libro', comoConjuro: { siempre: true, usos: 1, recarga: 'corto' } }],
  },
  'Wizard|Abjurer|3|Abjuration Savant': conjuroSub,
  'Wizard|Abjurer|10|Spell Breaker': conjuroSub,
  'Wizard|Abjurer|14|Spell Resistance': enJuego(),
  'Wizard|Diviner|3|Divination Savant': conjuroSub,
  'Wizard|Diviner|3|Portent': enJuego(),
  'Wizard|Diviner|10|The Third Eye': enJuego(),
  'Wizard|Evoker|3|Evocation Savant': conjuroSub,
  'Wizard|Evoker|6|Sculpt Spells': enJuego(),
  'Wizard|Illusionist|3|Illusion Savant': conjuroSub,
  'Wizard|Illusionist|3|Improved Illusions': conjuroSub,
  'Wizard|Illusionist|6|Phantasmal Creatures': conjuroSub,
  'Wizard|Illusionist|14|Illusory Reality': enJuego(),
  'Wizard|Bladesinger|3|Training in War and Song': {
    efectos: [{ tipo: 'competencia', categoria: 'arma', valor: 'martial melee (no 2H/H)' }],
    elecciones: [{ id: 'habilidad', tipo: 'habilidad', etiqueta: 'Training in War and Song', n: 1, de: ['acrobatics', 'athletics', 'performance', 'persuasion'] }],
  },
}

/** Clave de un rasgo en la tabla manual. */
export function claveManual(r: { className: string; subclassShortName?: string; level: number; name: string }): string {
  return `${r.className}|${r.subclassShortName ?? ''}|${r.level}|${r.name}`
}

export const DANOS = { DANOS_DRACONICOS, DANOS_ELEMENTALES }
