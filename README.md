# Herederos de la Miasma · App de personajes

Creación y gestión de personajes de D&D 2024 para la campaña Herederos de la Miasma. Funciona en el navegador (GitHub Pages): los jugadores no instalan nada.

- **Reglas:** se descargan al abrir la app desde el mirror público de 5etools (versión fijada en `src/datos/fuentes.ts`) y se guardan en caché. El repositorio no contiene texto de los libros.
- **Setting:** `src/setting/` adapta las reglas al mundo de la campaña (especies, trasfondos, subclases, marcas de aspecto, lenguas), a partir de las notas `Reglas/` de la bóveda de Obsidian.
- **Formas de Wild Shape:** las bestias salen de los bestiarios de las fuentes activas (XMM y XDMG, `BESTIARIOS_5ETOOLS`), que se descargan solo la primera vez que alguien se transforma (`src/datos/cargarBestias.ts`). `src/setting/formas.json` pone los nombres del setting y excluye lo que no existe en el mundo (dinosaurios); `src/motor/formas.ts` aplica el límite de VD y de vuelo del druida de 2024 y las Circle Forms del Círculo de la Luna (VD nivel/3, AC 13 + Sabiduría, PG temporales ×3).
- **Guardado:** Firebase (login con Google + Firestore). Mientras no esté configurado, la app funciona en **modo local** (solo en ese navegador).

## Desarrollo

```bash
npm install
npm run datos   # descarga los datos de 5etools para los tests (.cache-5etools/)
npm test        # motor de reglas: cobertura de rasgos de nivel 1 a 20, hoja, dados, Obsidian
npm run dev     # http://localhost:5173
```

## Puesta en marcha (una vez)

### 1. Firebase (gratis, plan Spark)
1. En <https://console.firebase.google.com> crea un proyecto (sin Analytics).
2. **Authentication → Sign-in method → Google**: actívalo.
3. **Authentication → Settings → Authorized domains**: añade `TU_USUARIO.github.io`.
4. **Firestore Database → Create database** (modo producción, región `europe-west`).
5. **Firestore → Rules**: pega el contenido de `firestore.rules` y publica.
6. **Project settings → Your apps → Web (`</>`)**: registra la app y copia el objeto `firebaseConfig` en `src/firebase/config.ts`. No es secreto: la seguridad la dan las reglas.
7. Abre la app, entra con tu cuenta de Google y pulsa «Crear la campaña»: quedas como DM.
8. En «Jugadores y campaña» añade el email de cada jugador.

### 2. GitHub Pages
1. Crea un repositorio en GitHub y sube este proyecto a la rama `main`.
2. **Settings → Pages → Source: GitHub Actions**.
3. Cada push a `main` pasa los tests y publica en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/datos/` | Descarga y procesado de los datos de 5etools |
| `src/setting/` | Capa del setting (JSON) y generador de las dotes de marca |
| `src/motor/` | Motor de reglas: resolvedor de elecciones, hoja derivada, efectos, fórmulas |
| `src/motor/rasgosManuales.ts` | Elecciones de rasgos que 5etools solo describe en texto |
| `src/motor/mecanicas.ts` | Recursos con usos y mecánicas pasivas de las clases |
| `src/almacen/` | Persistencia (local y Firebase) y objetos de la campaña (importación desde Obsidian) |
| `src/ui/` | Interfaz: creador, subida de nivel, hoja, almacén del DM |
| `tests/` | Tests del motor (`cobertura.test.ts` sube cada subclase del 1 al 20) |

## Pantalla del DM
Solo la ve el DM (botón «Pantalla del DM» en el inicio, o `#/pantalla`).
- **La nota de sesión:** se importa arrastrando un `.md` de `Sesiones/` de la bóveda, o con «Importar .md». Se guarda solo para el DM, porque lleva secretos: no va en el código de la app, que es público. Al volver a importarla se actualiza y conserva lo tachado.
- **Editar la nota:** con «✏ Editar» cada texto se cambia en el sitio, con su formato (negrita, cursiva, enlaces). Intro crea otra línea debajo y el botón ＋ entre bloques añade líneas de escena y tarjetas (narración, diálogo, tirada, reto, salvación, DM). Los cambios se guardan en la app; «Exportar .md» descarga la nota para sustituirla en la bóveda. `src/ui/dm/editarSesion.ts` hace los cambios línea a línea sin tocar el resto del texto.
- **La mesa:** los PJs activos en vivo (PG, AC, Percepción pasiva, condiciones, forma y aliados), el combate (iniciativa, ronda y turno) y el escenario de criaturas.
- **Daño y condiciones a los PJs:** cada tarjeta de PJ tiene Daño, Curar, Temp y condiciones (también Exhaustion). Se guarda en la hoja del jugador al momento. El daño sigue las reglas de 2024 (`dañarPj` en `src/almacen/mesa.ts`): gasta antes los PG temporales, avisa de la salvación de Concentración (CD), de caer a 0, de las salvaciones de muerte falladas y de la muerte instantánea.
- **Última tirada de daño:** el chip 🎲 de las tarjetas pone el total de la última tirada de daño (del DM o compartida por un jugador, de los últimos 5 minutos). «½» la parte por la mitad. «💥 Aplicar a varios» reparte daño o curación (todo, mitad o nada por objetivo) y una condición opcional.
- **Acciones de las criaturas:** cada tarjeta lleva sus acciones, adicionales, reacciones y legendarias con el bono de ataque, la CD de salvación y el daño pulsables (`resumenAccion` en `src/almacen/criaturas.ts`). Se abren solas en su turno. Tirar el daño de algo con recarga lo marca como gastado.
- **Relojes:** cuentas atrás en tiempo real (pitan al acabar y siguen en la cabecera) y relojes de pasos. Cada uno se puede enseñar a los jugadores u ocultar.
- **Apuntes:** notas rápidas con la hora y la ronda. «Pasar a la nota» las añade a la nota de sesión, en «## Apuntes de la mesa».
- **En pantallas anchas** la ventana no se desliza: la nota y la mesa tienen cada una su scroll.
- **Iniciativa:** las tiradas de iniciativa que comparten los jugadores desde su hoja entran solas. Los aliados de los PJs siguen las reglas de 2024: tiran la suya (familiares), actúan justo después del PJ (invocaciones) o dentro de su turno (Eldritch Cannon, Primal Companion).
- **Firestore:** la pantalla y las notas van en la colección `dm`, que solo puede leer y escribir el DM. Hay que publicar la versión actual de `firestore.rules`.

## La mesa (jugadores)
`#/mesa`, para todos. Mientras hay un combate (salvo que el DM lo oculte con «📺 Lo ven»), muestra el orden de iniciativa, la ronda y de quién es el turno. También muestra los relojes visibles. De las criaturas solo se ve cómo están (ileso, herido, malherido, caído), nunca sus PG ni las ocultas. En el inicio y en la hoja aparece un aviso con el turno («¡Te toca!») que lleva a la mesa. Sirve también para una pantalla grande en la mesa de juego.
- La publica la Pantalla del DM en `campanas/<id>/publico/mesa` (`construirMesa` en `src/almacen/mesa.ts`): la leen todos los miembros y solo la escribe el DM. Hay que publicar la versión actual de `firestore.rules`.

## Bestiario
Catálogo de criaturas del DM (botón «Bestiario» en el inicio, o `#/bestiario`). Se guarda en la colección `dm` (documentos `criatura-<id>`).
- Se crean en la app o se importan arrastrando notas de `Bestiario/` de la bóveda; al reimportar se actualiza la criatura. «Exportar .md» genera la nota con la plantilla «Criatura».
- El formato de la ficha (sección `## Estadísticas`) está explicado al principio de `src/almacen/criaturas.ts` y en la nota «App de personajes» de la bóveda.
- En el escenario de la Pantalla del DM cada criatura lleva su estado: usos «(N/día)», recargas «(Recarga X-6)» (se tiran solas al empezar su turno), acciones legendarias (se recuperan al empezar su turno), guarida (acción de guarida en la iniciativa 20, que pierde los empates), dominio de los acechadores y sinergias con otras criaturas o PJs presentes.
- Las fórmulas de dados y los bonos de ataque de la ficha se tiran al pulsarlos (tiradas privadas del DM).

## Si cambia una regla del setting
Edita el JSON de `src/setting/` y sube `version` en `src/setting/campaña.json` para que los navegadores recarguen los datos.
