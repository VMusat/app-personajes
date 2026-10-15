# La miasma · App de personajes

Creación y gestión de personajes de D&D 2024 para la campaña de la miasma. Funciona en el navegador (GitHub Pages): los jugadores no instalan nada.

- **Reglas:** se descargan al abrir la app desde el mirror público de 5etools (versión fijada en `src/datos/fuentes.ts`) y se guardan en caché. El repositorio no contiene texto de los libros.
- **Setting:** `src/setting/` adapta las reglas al mundo de la campaña (especies, trasfondos, subclases, marcas de aspecto, lenguas), a partir de las notas `Reglas/` de la bóveda de Obsidian.
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

## Si cambia una regla del setting
Edita el JSON de `src/setting/` y sube `version` en `src/setting/campaña.json` para que los navegadores recarguen los datos.
