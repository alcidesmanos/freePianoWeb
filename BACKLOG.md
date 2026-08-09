# Pianoforte Aurora Pro — Backlog

> **Leyenda:**
> Esfuerzo: `S` <1h · `M` 2-4h · `L` ~1 día · `XL` varios días
> Estado: `[ ]` pendiente · `[x]` hecho · `[~]` en progreso

---

## Estado actual (hecho)

### Base (sesión inicial)
- [x] Estética Aurora — mesh gradient animado, glassmorphism, fonts Plus Jakarta + Fraunces + JetBrains Mono
- [x] Motor de audio: Tone.js Sampler con Salamander Grand Piano + reverb por convolución sutil
- [x] **Sustain pedal real (CC 64)** — recibe del Yamaha, defiere releases
- [x] Web MIDI in/out (note on/off, sustain, hot-plug)
- [x] Falling notes — canvas separado, gradient por mano (cyan/magenta), glow al cruzar playhead
- [x] **Wait mode** — pausa hasta que toques la nota correcta, agrupa notas simultáneas
- [x] Parser MIDI estándar via `@tonejs/midi` (carga archivos .mid/.midi del usuario)
- [x] Slider de tempo de aprendizaje (40-150%)
- [x] Stats de lección: aciertos / fallos / precisión
- [x] Sistema de toasts unificado (4 tipos, dedup por id) + barra de progreso cancelable
- [x] Verificación de capacidades del browser al boot
- [x] Timeout duro en carga de samples (45s) + fetch de XML (8s con AbortController)
- [x] Detección hot-plug MIDI con toast informativo
- [x] OSMD para visor de partitura MusicXML
- [x] Splash de carga con progreso

### Implementado en sesiones recientes (sin estar en plan original)
- [x] **Soporte .mxl con JSZip** — descomprime el ZIP nosotros para evitar bug de OSMD con ArrayBuffer
- [x] **Auto-extracción de lección desde XML/MXL** (la fuente de verdad es el archivo, no hardcoded)
- [x] **Mini pentagrama** SVG con flag de nota tocada — soporta acordes con segundas alternadas y sostenidos en columna
- [x] **Score-following** — cursor OSMD avanza con la lección + auto-scroll
- [x] **Loop A-B** con marcas en progress bar, tempo progresivo, auto-extender
- [x] **Modo Silencio (play-along)** — autoplay avanza visual sin sonar; el usuario toca lo que ve
- [x] **Notas en teclas** — DO RE MI alineadas verticalmente al bottom de cada blanca
- [x] **3 modos de salida**: PC / Yamaha / Ambas (default Yamaha si hay teclado)
- [x] **20 instrumentos Tone.js** (Salamander + 19 del repo nbrosowsky) con dropdown filtrable
- [x] **Tabla PSR-E363**: 115 voces con Bank/PC para reverse lookup
- [x] **Auto-sync canal 1 ↔ Main Voice**: cambias voz física → app re-envía PC al canal 1
- [x] **Drum Kit XG** (Bank 127/0) seleccionable
- [x] **Detección automática de arpeggio** (warn cuando >12 Note On en 1.5s)
- [x] **Filtro de instrumentos** por nombre / categoría / código Bank/PC
- [x] **Voces dinámicas en dropdown** — si llega una voz no en tabla, se agrega automáticamente con sufijo *
- [x] **Token system** contra race conditions en cargas rápidas
- [x] **Cleanup robusto entre lecciones** — cancela timeouts, libera notas, all-notes-off al MIDI
- [x] **AllNotesOff + 60ms delay antes de Bank+PC** — cambio de voz mid-playback funciona
- [x] **Bank Select por canal** (no global, evita contaminación con Dual Voice)
- [x] **Anti-eco con _userSelectionLock** — descarta PC entrantes 1.5s después de selección manual
- [x] **Persistencia con localStorage**: outputMode, lessonMute, practiceMode, último instrumento
- [x] **Layout compactado** para que quepa en 1080p sin scroll
- [x] **Biblioteca local** de 79 partituras categorizadas en 12 carpetas + README.md índice navegable

### Sesión 2026-08-09 — calidad, teoría completa y rendimiento profesional
- [x] **Git local + suite de tests en 3 capas**: 131 unitarias (harness vm sobre el HTML intacto) + humo N1 (integridad HTML↔JS) + humo N2 (6 escenarios Playwright/Chromium) + 3 tests **condicionados a hardware MIDI** (`YAMAHA_LIVE=1 npm run smoke:yamaha`)
- [x] **Nivel 0**: 5 bugs del motor corregidos (tolerancias 10/30ms → grupos con referencias, cap 2.5s del autoplay, var legada en seekTo, sampler desincronizado al volver a PC, metrónomo sin depender de samples)
- [x] **P0 completo** (drag&drop, IndexedDB, atajos, estados vacíos, mezclador) y **P2 completo** (acordes, escalas, círculo de quintas, números romanos, oído)
- [x] **Grabadora MIDI v1** (P4 parcial): captura → reproducir / usar como lección / exportar .mid
- [x] **Auditoría instrumentada** (`node smoke/auditoria.js`, 7 métricas) + informe HTML (`informe_auditoria.html`, publicado como artifact) → dirigió 3 mejoras medidas:
  - draw() coalescido a 1×/frame (ráfaga MIDI 501→99ms)
  - modo rendimiento ⚡ con auto-detección de fps (el compositor glass era el cuello: 18→55 fps; el canvas cuesta 0.22ms)
  - **autoplay en el reloj de audio** (lookahead 120ms + timestamps Web MIDI): jitter 29.5→**2.28ms media — objetivo profesional cumplido**
- [x] **Fix cambio de instrumento tras fallo de carga** (bug reportado): supersede por token (último click gana), fallo total rechaza en ~14ms (antes 35s de silencio), timeout 12s con conteo real de buffers, dispose del sampler fallido — verificado con DevTools (red cortada)
- [x] **Für Elise embebida en el HTML** (base64 de `Fur_Elise_fingered.mxl`, 219 digitaciones): la URL externa murió con 404; el demo de un click ahora funciona sin red, offline y desde file://
- [x] **Docs**: manual de usuario (`ayuda.html`, botón ?), README técnico con arquitectura y decisiones, pieza pop original de práctica (`library/11-personal/Atardecer_balada_pop_original.musicxml`)
- [x] **Guía de posición de manos** ⭐ (toggle "Posición manos"): banda cyan/magenta sobre el span de 5 blancas donde reposa cada mano, punto en el pulgar; con digitaciones ancla exacto (dedo N sobre tecla M), sin ellas estima por rango (marcada ~); sigue el wait mode y el autoplay, respeta manos separadas — `test/posicion.test.js` (9 casos)

---

## P0 — Pulido fino antes de migrar a Angular

### UX inmediata

- [x] **Drag & drop de archivos** `[S]` — **HECHO 2026-08-09**
  - `.mid/.midi/.xml/.musicxml/.mxl` con overlay (borde punteado cyan + "Suelta el archivo")
  - `classifyPianoFile` enruta a `loadMidiFromFile`/`loadXmlFromFile` (loaders refactorizados a File directo)
  - Tests de enrutado en `test/dragdrop.test.js`

- [x] **Persistencia local con IndexedDB** `[M]` — **HECHO 2026-08-09**
  - Guarda: última canción (notas extraídas + nombre + bpm), transposición, filtro de manos, tempo, wait mode, modo nota, BPM metrónomo
  - Restaura al abrir (toast "Sesión restaurada"); guarda en loadSong, cambios de transposición/filtro, pestaña oculta y pagehide
  - Snapshot versionado (`v:1`) y aplicación defensiva (campos corruptos se ignoran) — `test/sesion.test.js`

- [x] **Atajos de teclado** `[S]` — **HECHO 2026-08-09**
  - `Espacio`=play/pausa · `R`=reiniciar · `W`=wait mode · `M`=metrónomo · `+/-`=tempo ±5%
  - Nunca interceptan inputs/selects ni combos Ctrl/Cmd; tooltips actualizados — `test/atajos.test.js`

- [x] **Estado vacío del lesson-panel** `[S]` — **HECHO 2026-08-09**
  - Panel `#lesson-empty` con ícono + mensaje + CTAs (Für Elise / Cargar MIDI / Cargar partitura); se oculta al cargar lección

- [x] **Loading state en el botón Für Elise** `[S]` — **HECHO 2026-08-09**
  - Ambos botones (toolbar y estado vacío, `data-furelise`) quedan disabled con la estrella girando durante la descarga

### Audio / expresión

- [ ] ~~**Pedal soft (CC 67)**~~ `[S]` — **DESCARTADO para PSR-E363**
  - El PSR-E363 NO envía CC 67 (solo tiene jack de sustain CC 64). Feature muerta sin hardware de 3 pedales.
  - Reactivar solo si se cambia a un teclado que lo soporte.

- [ ] ~~**Pedal sostenuto (CC 66)**~~ `[M]` — **DESCARTADO para PSR-E363**
  - El PSR-E363 NO envía CC 66. Igual que el soft: muerto sin hardware compatible.
  - (Nota 2026-05-04: el sustain CC 64 ya implementado es el único pedal que el hardware soporta. Pedalear además es habilidad intermedia, no prioridad para principiante.)

- [x] **Volumen separado piano / metrónomo / sample-playback** `[S]` — **HECHO 2026-08-09**
  - Panel "Mezclador" en el bottom-bar: Piano (dB del sampler), Metró. (volumen del click, default 70) y Lección (escala velocity del autoplay, local y MIDI out)
  - Persistido en localStorage (`pianopro:mix`) — `test/mezclador.test.js`

- [ ] **Modo nota: ahora también italiano y francés** `[S]`
  - Toggle se vuelve cycle: EN → ES → IT → FR → EN
  - Italiano: Do Re Mi (igual que ES sin acento gráfico distinto)
  - Francés: Do Ré Mi Fa Sol La Si (con `ré`)

### Aprendizaje

- [x] ~~**Score-following en OSMD**~~ `[L]` — duplicado: ya hecho (ver "Estado actual"), solo falta el parpadeo rojo al fallar
  - Durante reproducción, mover el cursor de OSMD a la nota actual
  - API: `osmd.cursor.show()` + `osmd.cursor.next()` sincronizado con tiempo de canción
  - Si fallaste la nota, parpadeo rojo en la cabeza de la nota

- [x] **Próxima nota visible en hero display (modo wait)** `[S]` ⭐ **LEARNING LEVER #1 — HECHO 2026-05-04**
  - Pista tenue (38% opacity, itálica) de la próxima nota/acorde en el display grande, en modo wait
  - Acoplada a "Notas en teclas" (`practiceMode`): un solo switch "modo principiante" enciende DO-RE-MI en teclas + pista en hero
  - `showNextNoteHint()` se llama desde updateHighlight, el chord-clear timer y setPracticeMode
  - Al tocar la nota correcta → se confirma sólida (sin clase hint), luego reaparece la pista de la siguiente

- [x] ~~**Loop A-B**~~ `[M]` — duplicado: ya hecho (ver "Estado actual")

- [x] **Modo "manos separadas"** `[M]` ⭐ **LEARNING LEVER #2 — HECHO 2026-08-09**
  - Control segmentado Ambas/Izq/Der en el lesson-panel (`setHandFilter`)
  - `songState.allNotes` (pieza completa) vs `songState.notes` (filtradas); grupos rebuild + `seekTo(getSongTime())` conserva posición y stats
  - La mano filtrada se sigue viendo ATENUADA en gris en falling notes (contexto sin obligación)
  - Si la pieza no tiene esa mano → revierte a Ambas con aviso
  - Tests en `test/manos.test.js` (7 casos)

- [x] **Digitaciones desde XML** `[L]` ⭐ **LEARNING LEVER #3 — HECHO 2026-08-09**
  - Extracción en `_extractFromVoiceEntry`: lee `note.Fingering` o `ve.TechnicalInstructions` (asociación por `sourceNote`; con acorde + instrucción ambigua NO adivina) → `finger:1-5` en la nota
  - Se muestra en: falling notes (número al borde inferior de la barra) y badge circular sobre la tecla resaltada en wait mode (`highlightedFingers`), color por mano
  - Si el archivo NO trae digitación → no se muestra nada (sin heurística que enseñe mal)
  - Tests en `test/digitacion.test.js` (6 casos con fixtures OSMD)
  - **VALIDADO en navegador real** (2026-08-09, smoke test Playwright): OSMD 1.9 entrega las 37/37 digitaciones de `Atardecer_balada_pop_original.musicxml` a las notas de la lección
  - Pendiente menor: número también en el mini pentagrama (recortado de alcance)
  - **8 archivos de la biblioteca ya la traen marcada**: Fur_Elise_fingered (219), Chopin Ballade (858), The Entertainer (96), Chopin Nocturne Op9No2 (96), Canon in D easy (67), Marcha Turca fingered (57), Waltz A minor (46), Greensleeves (14)

- [x] **Transponer canción** `[S]` — **HECHO 2026-08-09**
  - Botones `−1`/`+1` con indicador en el lesson-panel; acumulable hasta ±12
  - `origMidi` como fuente de verdad; guarda de rango A0-C8; convive con manos separadas
  - Tests en `test/transponer.test.js` (7 casos)

---

## P1 — Sonido pro y multitimbralidad

- [ ] **Selector de instrumento** `[L]`
  - Tone.Sampler con presets: Grand Piano (actual), Rhodes, Hammond Organ, Strings, Pad
  - Buscar samples libres (Versilian Studios, FreePats, sfz)
  - Cargar bajo demanda (no precargar todos)
  - Persistir selección

- [ ] **Split / layer keyboard** `[M]`
  - Split: punto de corte (default C4) — izquierda = bajo, derecha = piano
  - Layer: dos instrumentos sonando simultáneamente
  - UI: panel "Voces" colapsable

- [ ] **IRs de reverb seleccionables** `[M]`
  - Hoy: Tone.Reverb generado (sintético)
  - Mejor: archivos IR reales (sala concierto, jazz club, dormitorio, catedral, plate)
  - Cargar como `Tone.Convolver`

- [ ] **Velocity curve configurable** `[S]`
  - Algunos teclados Yamaha mandan velocity demasiado bajo o alto
  - Curva: lineal / suave / dura, slider de offset
  - Usuario calibra una vez y la guardamos

- [ ] **Detección y compensación de latencia** `[M]`
  - Test: usuario pulsa una tecla, mide tiempo entre `noteOn` MIDI y siguiente frame de audio
  - Mostrar ms y guía de cómo bajar buffer en navegador

---

## P2 — Teoría y análisis en tiempo real

- [x] **Detección de acordes en tiempo real** `[L]` — **HECHO 2026-08-09**
  - `detectChord`: 20 formas (tríadas, sus, 6ª, 7ªs, 9ªs, power chord) como conjuntos de intervalos; prueba cada pitch class como fundamental, prefiere la que está en el bajo y nombra inversiones como slash (`C/E`); octavas dobladas no estorban
  - Notas activas = presionadas + retenidas por sustain (`_chordPressed`/`_chordSustained`, independiente del modo de salida — funciona en modo Yamaha)
  - Chip dorado flotante en el hero (`#chord-display`), nombres EN/ES según modo nota
  - Ambigüedad C6 vs Am7 resuelta por el bajo — `test/acordes.test.js` (10 casos)

- [x] **Círculo de quintas interactivo** `[M]` — **HECHO 2026-08-09**
  - SVG de 24 segmentos generado por código (anillo exterior mayores, interior relativas menores), toggle "Círculo 5ªs" en toolbar, construcción perezosa
  - Detección de tonalidad: histograma rodante de las últimas 32 notas, puntuación por escala con bonos tónica/dominante/relativa → segmento dorado + etiqueta "C · Am"
  - Click en un segmento → fija esa escala en la biblioteca (selector + teclado resaltado) y la toca como preview ascendente
  - `test/circulo.test.js` (8 casos, incl. la propiedad "cada paso del círculo es una quinta")

- [x] **Ear training** `[L]` — **HECHO 2026-08-09** · P2 COMPLETO
  - Panel "Oído" (toolbar): la app toca SOLO audio (sin pistas visuales) y el usuario lo repite en el teclado
  - 4 niveles: intervalos (7 tipos) → tríadas (may/min/dim) → séptimas (7/maj7/m7/dim7) → escalas (5 formas + octava)
  - Acordes en cualquier orden; melódico exige la secuencia exacta; fallo = reintento del mismo ejercicio; Revelar cuenta como fallo y dice qué era
  - Racha/mejor/precisión persistidas (`pianopro:ear`); prioridad sobre el wait mode (no contamina stats de lección)
  - `test/oido.test.js` (9 casos) · smoke condicionado a hardware en `smoke/yamaha.spec.js` (se omite sin teclado; `YAMAHA_LIVE=1 npm run smoke:yamaha` para el interactivo)

- [x] **Análisis armónico (Roman numerals)** `[L]` — **HECHO 2026-08-09**
  - `romanNumeralFor`: mayúsc/minúsc por calidad, ° y ø, cromáticos con bemol (bVII, bVI…); chip violeta bajo el de acordes con la progresión rodante (últimos 4 grados)
  - Tonalidad: la escala fijada manda (menor → relativa mayor); si no, la detectada por el círculo. Cambio de tonalidad resetea la progresión
  - Solo los noteOn alimentan la progresión (los acordes transitorios al soltar no la ensucian); completar un acorde refina el grado en vez de duplicarlo
  - `test/armonia.test.js` (8 casos, incl. I–V–vi–IV tocado de verdad)

- [x] **Biblioteca de escalas** `[M]` — **HECHO 2026-08-09**
  - 12 formas (mayor, 3 menores, modos griegos, 2 pentatónicas, blues) en `SCALE_SHAPES`; selector tónica + tipo + toggle en toolbar
  - Teclas de la escala en teal, tónica en dorado; convive con el highlight de lección (solo pinta teclas libres) → funciona mientras practicas
  - Persistido en localStorage — `test/escalas.test.js` (9 casos, incl. relativas Am=C y modal D dórico=C)
  - Pendiente de la idea original: voicings (recortado de alcance)

---

## P3 — Análisis de práctica y progreso

- [ ] **Dashboard de progreso** `[XL]`
  - Vista separada (post-Angular): minutos por día, racha, canciones completadas, gráfica de evolución
  - Stats por canción: mejor precisión, número de intentos, BPM dominado
  - Persistir en IndexedDB

- [ ] **Heatmap del teclado** `[M]`
  - Mientras practicas, registrar qué notas tocaste cuántas veces
  - Visualización: cada tecla tinted por intensidad de uso
  - Útil para detectar rangos que no usas

- [ ] **Score 0-100 por canción** `[M]`
  - Algoritmo: precisión de notas (40%), timing vs metrónomo (30%), dinámica respetada (15%), notas extra/perdidas (15%)
  - Leaderboard personal histórico
  - Compartible vía URL si en el futuro hay backend

- [ ] **Feedback de desviación rítmica — "Camino B" del cuantizador** `[M]`
  - NO corrige el timing: lo MIDE y lo muestra. Es la mitad pedagógica del cuantizador.
  - Captura el tiempo de cada Note On con `Tone.now()` (NO `e.timeStamp` ni `performance.now()`) dentro del handler MIDI → mismo dominio de reloj que el metrónomo (ya migrado a lookahead scheduler con `Tone.now()` el 2026-05-04).
  - Compara contra la grilla del metrónomo (negra/corchea/semicorchea) y reporta:
    - Desviación por nota: "+45ms tarde / -20ms adelantado"
    - Tendencia: "te adelantas en tiempos débiles", rushing/dragging
    - Consistencia del pulso: ±ms de varianza
  - UI ligera primero: indicador en vivo "vas adelante/atrás del pulso" (flecha o barra).
  - **PRERREQUISITO HECHO**: metrónomo en `Tone.now()` (audio clock). Sin eso heredaba jitter de `setInterval`.
  - **CUÁNDO ACTIVARLO**: prematuro para principiante (primero notas correctas + coordinar manos; Wait Mode + metrónomo cubren los primeros meses). Valioso cuando ya toque piezas completas y quiera pulir el groove. Ver nota completa en `memory/` y discusión del 2026-05-04.

- [ ] **Detección de errores recurrentes** `[L]`
  - Tras N sesiones, identificar las notas/transiciones que sistemáticamente fallas
  - Generar ejercicios dirigidos a esos puntos débiles

- [ ] **Replay visual** `[M]`
  - Tras una sesión, poder reproducirla a velocidad ajustable viendo dónde acertaste y dónde fallaste

---

## P4 — Composición y creatividad

- [~] **Grabación MIDI multitrack** `[L]` — **v1 MONOPISTA HECHA 2026-08-09**
  - [x] Grabar → captura con timestamps (overhead medido 0.9ms) · reproducir · usar como lección · exportar .mid
  - [ ] Multitrack: hasta 4 capas con loop independiente (pendiente)

- [x] **Cuantización post-grabación — "Camino A" (corregir/snap)** `[M]` — **HECHO 2026-08-09**
  - Selector en la grabadora: Off / 1/8 / 1/16 / Swing (contratiempo a 2/3 = tresillo)
  - Grilla anclada al BPM del metrónomo (flujo: grabar con el click puesto); primera nota de la toma = pulso 1
  - Siempre recalcula desde la toma CRUDA (`take.raw`): cambiar de grilla no acumula error, Off restaura el timing humano exacto
  - Los acordes "desparramados" quedan verticales; reproduce/lección/export usan la versión cuantizada — `test/cuantizador.test.js` (8 casos)
  - Distinto del "Camino B" en P3 (que mide sin corregir, para enseñar).

- [ ] **Backing tracks** `[L]`
  - Drum loops + bajo programados en Tone.Sequence
  - Tonalidad y BPM ajustables
  - Géneros: jazz swing, rock 4/4, bossa nova, blues 12 compases

- [~] **Export** `[M]`
  - [x] MIDI estándar (con `@tonejs/midi`) — HECHO 2026-08-09 en la grabadora
  - [ ] WAV mezclado (con `Tone.Offline`)
  - [ ] MusicXML auto-generado de tu interpretación (requiere cuantizador — Camino A)

- [ ] **Modo "improvisar sobre cambios"** `[L]`
  - Cargas una progresión (Cmaj7 → Am7 → Dm7 → G7), backing track la reproduce en bucle
  - Sugerencias visuales de escala compatible con cada acorde

---

## P5 — Plataforma (post-migración Angular)

- [ ] **Migrar a Angular standalone** `[XL]`
  - Estructura: `core/audio.service`, `core/midi.service`, `core/lesson.service`, `shared/piano-keyboard`, `shared/falling-notes`, `pages/play`, `pages/lessons`, `pages/library`, `pages/progress`
  - TypeScript types para `Song`, `Note`, `MidiEvent`, `LessonState`
  - Routing: rutas perezosas por página

- [ ] **PWA instalable** `[M]`
  - Service worker con Workbox
  - Cachear samples de Salamander para offline
  - Manifest + ícono propio
  - Instalable en escritorio Windows / móvil Android

- [ ] **Biblioteca de canciones precargada** `[L]`
  - 20-30 piezas clásicas (Bach inventiones, Chopin nocturnos, Beethoven sonatas fáciles)
  - Curadas por nivel (principiante → avanzado)
  - MIDI + MusicXML pre-procesados, hosteados en GitHub Pages o Cloudflare R2
  - Búsqueda + filtros (compositor, nivel, época)

- [ ] **Settings persistidas** `[M]`
  - Pantalla de ajustes: modo nota, fuente preferida, instrumento default, tonalidad de calentamiento, vol máster
  - IndexedDB

- [ ] **Multi-perfil local** `[M]`
  - Varios perfiles en el mismo navegador (familia, alumnos)
  - Cada uno con su progreso aislado

---

## P6 — Features experimentales / IA

- [ ] **Transcripción audio → MIDI** `[XL]`
  - Subes un MP3, sale partitura aproximada
  - Modelo: Magenta.js Onsets-and-Frames o Basic-Pitch (Spotify, ONNX en el browser)
  - Postproceso: cuantización + agrupar voces

- [ ] **Generador de ejercicios personalizados (LLM)** `[L]`
  - Input: tus errores recurrentes detectados
  - Output: Hanon-like ejercicios MIDI generados a medida
  - Llamada a API Claude / GPT con tool use

- [ ] **"Continúa esta melodía"** `[L]`
  - Tocas 4 compases, IA propone los siguientes 4
  - Magenta.js MusicRNN o TransformerComposer en cliente
  - Aceptar / regenerar / descartar

- [ ] **Asistente conversacional** `[XL]`
  - "Enséñame Clair de Lune por partes, empieza por compás 1-8"
  - LLM agente que carga MIDI, configura wait mode, guía paso a paso
  - Requiere backend o API key del usuario

- [ ] **Análisis estético de interpretación** `[XL]`
  - "Suena más rubato aquí" / "esta frase quedó cuadrada"
  - LLM analiza tu MIDI grabado vs el original
  - Feedback en lenguaje natural

---

## Deuda técnica / bugs conocidos

- [ ] **Vista real (zoom) en piano-wrapper**: el scroll horizontal funciona, pero el `falling-canvas` puede tener `width:100%` mientras el bitmap es 1400px. Verificado fix pero validar manualmente con teclado al máximo zoom.

- [ ] **Tempo change durante playback en wait mode**: al mover el slider, ajustamos `pausedAt` y `startPerf`. En auto mode funciona; en wait mode con grupo en espera puede haber salto visual. Reproducir y comprobar.

- [x] **Acordes simultáneos en wait mode** — RESUELTO 2026-08-09: `GROUP_TOLERANCE` subida a 60ms (tolera acordes "humanos" de MIDIs grabados en vivo). El bug de notas huérfanas 10ms/30ms se corrigió antes guardando referencias en los grupos (tests BUG 0.1/0.1b).

- [ ] **Memoria con muchas notas**: cada `setTimeout` para auto-mode crea un closure por nota. Para canciones largas (>2000 notas), considerar un solo loop con cola.

- [ ] **OSMD render lento con piezas largas**: una sonata de 30 páginas tarda en `render()`. Mostrar progreso o loader. Considerar virtualización (no soportada nativamente).

- [ ] **iOS Safari**: backdrop-filter funciona, pero AudioContext requiere gesto del usuario y el MIDI USB no funciona (limitación iOS). Documentar como "requiere Chrome/Edge en escritorio".

- [ ] **Sample loading sobre redes lentas**: 30 archivos mp3 de Salamander pueden tardar >30s en redes pobres. Considerar versión low-quality (16kbps) para fallback.

- [ ] **Limpieza de listeners**: al recargar / migrar a Angular, asegurar que `inp.onmidimessage`, `Tone` instances, scheduler del metrónomo (`_metroSchedulerId`), `rafId` se limpian correctamente.

- [x] **Pestaña en background congela y salta (Page Visibility)** `[S]` — **RESUELTO 2026-05-04**
  - Síntoma: al perder visibilidad la pestaña, `requestAnimationFrame` (playLoop) se detiene pero `getSongTime()` usa `performance.now()` que sigue corriendo. Al volver, `t` saltó adelante → el modo auto dispara TODAS las notas entre el congelamiento y ahora en ráfaga = **sonido abrupto al volver**. Misma clase de bug que el burst del Loop A-B (ya arreglado con return + rAF).
  - Fix: `document.addEventListener('visibilitychange', ...)`:
    - `document.hidden` → pausar lección (songState.playing=false) + parar metrónomo + soltar notas activas + cancelar `_pendingAutoTimeouts` + AllNotesOff al MIDI
    - visible de nuevo → NO auto-reanudar (dejar en pausa para que el usuario decida) o reanudar re-anclando `startPerf=performance.now()` para que no haya salto
  - Comportamiento del navegador es INTENCIONAL (throttle de timers + rAF detenido en tabs ocultas). El fix es manejar la transición, no pelear con el throttle.

---

## Roadmap sugerido

1. **Sprint 1** (1-2 días): cerrar P0 completo (drag&drop, persistencia, atajos, pedales soft/sostenuto, volúmenes, score-following, transponer)
2. **Sprint 2** (2-3 días): P1 sonido (selector instrumentos, IRs, velocity curve)
3. **Sprint 3** (2-3 días): P2 teoría (detección acordes, círculo quintas, escalas)
4. **Decisión Angular**: migrar AHORA antes de seguir con P3+
5. **Sprint 4-N** post-Angular: dashboard, biblioteca, PWA, IA

---

_Última actualización: 2026-05-04 — metrónomo migrado a lookahead scheduler (Tone.now); cuantizador anotado en 2 caminos (A corregir / B medir)_
