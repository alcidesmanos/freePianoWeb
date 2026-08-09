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

---

## P0 — Pulido fino antes de migrar a Angular

### UX inmediata

- [ ] **Drag & drop de archivos** `[S]`
  - Soltar `.mid`, `.midi`, `.xml`, `.musicxml` sobre la página
  - Detectar tipo por extensión y enrutar a `loadMidiFile` / `loadXmlFile`
  - Overlay visual al arrastrar (ring cyan, mensaje "Suelta el archivo")

- [ ] **Persistencia local con IndexedDB** `[M]`
  - Guardar: última canción cargada (notas + nombre + bpm), modo nota ES/EN, tempo de aprendizaje, vista general/real, estado del metrónomo
  - Restaurar al cargar la página
  - Razón: recargar el navegador no debería tirar lo que estabas haciendo

- [ ] **Atajos de teclado** `[S]`
  - `Espacio` = play/pause de la lección
  - `R` = reiniciar
  - `W` = toggle wait mode
  - `M` = toggle metrónomo
  - `+/-` = tempo ±5%
  - Indicar atajos en tooltips de los botones (`title=`)

- [ ] **Estado vacío del lesson-panel** `[S]`
  - Hoy: cuando no hay canción, el panel está oculto
  - Mejor: mostrar un panel placeholder con CTA "Carga un MIDI o pulsa Für Elise"
  - Igual que principio UX en CLAUDE.md (estados vacíos con ícono + mensaje + CTA)

- [ ] **Loading state en el botón Für Elise** `[S]`
  - Mientras descarga el XML, el botón muestra spinner inline y queda `disabled`
  - Evita que se haga clic dos veces

### Audio / expresión

- [ ] ~~**Pedal soft (CC 67)**~~ `[S]` — **DESCARTADO para PSR-E363**
  - El PSR-E363 NO envía CC 67 (solo tiene jack de sustain CC 64). Feature muerta sin hardware de 3 pedales.
  - Reactivar solo si se cambia a un teclado que lo soporte.

- [ ] ~~**Pedal sostenuto (CC 66)**~~ `[M]` — **DESCARTADO para PSR-E363**
  - El PSR-E363 NO envía CC 66. Igual que el soft: muerto sin hardware compatible.
  - (Nota 2026-05-04: el sustain CC 64 ya implementado es el único pedal que el hardware soporta. Pedalear además es habilidad intermedia, no prioridad para principiante.)

- [ ] **Volumen separado piano / metrónomo / sample-playback** `[S]`
  - 3 sliders en un menú "Mezclador" colapsable
  - Hoy todo va a master, lo que hace que el metrónomo en BPM alto tape el piano

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

- [ ] **Digitaciones desde XML** `[L]` ⭐ **LEARNING LEVER #3**
  - Extraer `<fingering>` del MusicXML (OSMD: `note.notations` / voice entries) → guardar `finger:1-5` en cada nota
  - Mostrar el número en: falling notes (centro de la barra), pentagrama mini (arriba de la cabeza), sobre la tecla resaltada en wait mode
  - Color por mano (cyan izq / magenta der) coherente con el resto
  - Si el archivo NO trae digitación → no mostrar nada (sin heurística que enseñe mal)
  - **8 archivos de la biblioteca ya la traen marcada**: Fur_Elise_fingered (219), Chopin Ballade (858), The Entertainer (96), Chopin Nocturne Op9No2 (96), Canon in D easy (67), Marcha Turca fingered (57), Waltz A minor (46), Greensleeves (14)
  - Es la "guía de manos" que pidió el usuario

- [ ] **Transponer canción** `[S]`
  - Botones `+1` `-1` en el lesson-panel
  - Aplicar offset a `note.midi` al renderizar y reproducir
  - Útil para tonalidades cómodas

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

- [ ] **Detección de acordes en tiempo real** `[L]`
  - Mientras tocas, identifica el acorde formado: Cmaj7, Dm9/F, etc.
  - Algoritmo: tomar las últimas N notas activas (sustain o presionadas), normalizar a una root, buscar coincidencia en biblioteca de chord shapes
  - Mostrar en flotante junto al hero display

- [ ] **Círculo de quintas interactivo** `[M]`
  - SVG con 12 segmentos
  - Detectar tonalidad de lo que tocas y resaltar el segmento (mayor + relativa menor)
  - Click en un segmento → toca la escala correspondiente

- [ ] **Ear training** `[L]`
  - Modo: el sistema toca un intervalo / acorde / escala
  - Usuario lo identifica tocándolo en el teclado
  - Niveles: intervalos simples → acordes triada → 7ths → modos
  - Persiste progreso

- [ ] **Análisis armónico (Roman numerals)** `[L]`
  - Mientras tocas una progresión, mostrar I-V-vi-IV o ii-V-I
  - Requiere detección de tonalidad estable + chord detection

- [ ] **Biblioteca de escalas y voicings** `[M]`
  - Selector: tonalidad + tipo (mayor, menor natural/armónica/melódica, dórico, frigio…, blues, pentatónica)
  - Resaltar las teclas correspondientes en el piano
  - Aplica a lección: "muéstrame las notas de la escala mientras toco"

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

- [ ] **Grabación MIDI multitrack** `[L]`
  - Botón "Grabar" → captura cada nota con timestamp preciso
  - Hasta 4 capas (bajo, acordes, melodía, percusión simulada)
  - Loop de cada capa independiente

- [ ] **Cuantización post-grabación — "Camino A" (corregir/snap)** `[M]`
  - 1/8, 1/16, swing, off
  - Mueve cada nota al tick más cercano de la grilla → tu timing humano se vuelve perfecto.
  - Aplicar a una capa concreta o al global
  - Uso: capturar algo que improvisaste/sacaste de oído → exportar a MusicXML/MIDI limpio (componer/grabar, NO aprender).
  - Distinto del "Camino B" en P3 (que mide sin corregir, para enseñar). Ver discusión del 2026-05-04.

- [ ] **Backing tracks** `[L]`
  - Drum loops + bajo programados en Tone.Sequence
  - Tonalidad y BPM ajustables
  - Géneros: jazz swing, rock 4/4, bossa nova, blues 12 compases

- [ ] **Export** `[M]`
  - MIDI estándar (con `@tonejs/midi`)
  - WAV mezclado (con `Tone.Offline`)
  - MusicXML auto-generado de tu interpretación (para abrir en MuseScore)

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

- [ ] **Acordes simultáneos en wait mode**: los grupos se forman con tolerancia 30ms (`GROUP_TOLERANCE`). Si un MIDI tiene un acorde con notas desfasadas >30ms, se separan en grupos. Considerar subirla a 60ms (ahora es cambiar UNA constante; el bug de notas huérfanas 10ms/30ms se corrigió el 2026-08-09 guardando referencias en los grupos — tests BUG 0.1/0.1b).

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
