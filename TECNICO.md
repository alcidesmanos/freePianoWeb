# freePianoWeb — Documentación técnica

_Documentación técnica del proyecto — el README público está en [README.md](README.md)._

Piano de 88 teclas en el navegador con lecciones interactivas, integración profunda con el
Yamaha PSR-E363, teoría musical en tiempo real, entrenamiento de oído y grabadora MIDI.
**Manual de usuario**: `ayuda.html` (botón `?` en la app).

_Actualizado: 2026-08-09_

---

## Origen del nombre

**Pianoforte** es el nombre original italiano del piano (el *gravicembalo col piano e
forte* de Cristofori, ~1700: el primer teclado que sonaba suave Y fuerte según el
toque — como esta app, que responde a velocity). **Aurora** fue la estética ganadora
de un concurso de 4 maquetas la mañana del 2026-05-01 (aurora, linear, synthwave y
bento — conservadas en `backup/`): el fondo mesh-gradient animado tipo aurora boreal
(`@keyframes aurora`). **Pro** marcó el salto funcional sobre esos prototipos:
Salamander Grand, Web MIDI y falling notes.

El 2026-08-09 la app se integró a la familia `free*` del autor (freeDFDWeb,
freeBPMN…) como **freePianoWeb**, conservando *Pianoforte Aurora* como nombre de
edición. Las claves internas de almacenamiento (`pianopro:*`) se mantienen por
compatibilidad con las sesiones guardadas.

## Filosofía: un solo archivo

`index.html` es la aplicación completa (~4.400 líneas: CSS + markup + JS). Sin build,
sin framework, sin dependencias de runtime instalables: **lo copias, lo pegas, lo usas**.
Las 4 librerías (Tone.js, @tonejs/midi, JSZip, OSMD) llegan por CDN.

La decisión está razonada: el 90% del código es tiempo real imperativo (canvas 60fps,
Web MIDI, audio scheduling) donde un framework no aporta; la modularización, si algún
día duele, será con build que inline (fuentes separadas → mismo artefacto único),
no con Angular. Ver discusión completa en la sesión del 2026-08-09.

## Mapa del proyecto

```
index.html      ← LA APLICACIÓN (único archivo de producción)
ayuda.html          ← manual de usuario (compañero opcional)
BACKLOG.md          ← roadmap y estado por prioridades (P0…P6)
package.json        ← solo scripts de test y devDependency de Playwright
test/               ← unitarias + humo N1 (cero dependencias, node:test)
  harness.js        ←   evalúa el <script> del HTML en vm con stubs de DOM
  *.test.js         ←   125 tests
smoke/              ← humo N2 en Chromium real (Playwright)
  server.js         ←   estático mínimo (puerto 8123, sin dependencias)
  humo.spec.js      ←   8 escenarios end-to-end
  yamaha.spec.js    ←   3 escenarios CONDICIONADOS a hardware MIDI real
library/            ← 85 partituras en 12 categorías (untracked)
teoria/             ← apuntes de teoría musical del usuario (untracked)
```

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│ BOOT: layout → voces Yamaha → checks → restore (localStorage +  │
│       IndexedDB) → initMIDI → initAudio(samples CDN) → rAF loop │
├──────────────┬───────────────────────┬──────────────────────────┤
│ ENTRADA      │  NÚCLEO               │  SALIDA                  │
│ MIDI-in ─────┤ noteOn/noteOff        ├─► Tone.Sampler + reverb  │
│ canvas/touch │  (unificado, source)  ├─► MIDI-out (Yamaha)      │
│ .mid/.xml/   │ songState (lección)   ├─► canvas piano + badges  │
│  .mxl/drop ──┤ loopState (A-B)       ├─► falling notes canvas   │
│ grabadora ───┤ recState (capturas)   ├─► hero + chips teoría    │
│ oído ────────┤ earState (ejercicios) ├─► mini pentagrama SVG    │
│              │ metrónomo (lookahead) ├─► cursor OSMD            │
│              │ escalas/círculo/keys  ├─► toasts                 │
└──────────────┴───────────────────────┴──────────────────────────┘
```

### Cadena de una nota del usuario (noteOn)

```
noteOn(midi, vel, source)
 ├─ MIDI-out (si salida Yamaha y source ≠ midi-in)     — eco evitado
 ├─ audio local (si salida PC/Ambas)                    — sampler
 ├─ activeKeys + draw()                                 — tecla iluminada
 ├─ showNote()                                          — hero + pentagrama
 ├─ chip de acordes (detectChord sobre pressed+sustain)
 ├─ detección de tonalidad (histograma 32 notas)
 ├─ grabadora (_recNoteOn, si armada/grabando)
 └─ oído  ► si hay ejercicio activo, CONSUME la nota
    └─ si no ► wait mode de la lección (registerUserHit)
```

### Decisiones no obvias que NO hay que romper

| Decisión | Por qué |
|---|---|
| `sendYamahaProgramChange` en 2 fases con delay 60ms | El PSR-E363 procesa notas con la voz vieja si Bank+PC llegan pegados al AllNotesOff |
| Bank Select **por canal** (`_yamahaBankByCh`) | El Dual Voice del canal 2 contaminaba un bank global |
| `_userSelectionLock` 1.5s | El Yamaha eco-responde a los PC; sin lock pisaba la selección manual |
| Grupos con **referencias** a sus notas (`buildGroups`) | Buscar por tiempo con tolerancia creó notas huérfanas mudas (bug 2026-08-09) |
| `GROUP_TOLERANCE = 60ms` | Acordes "humanos" de MIDIs grabados en vivo llegan desfasados |
| Metrónomo con lookahead sobre el reloj de audio | `setInterval` hereda el jitter del event loop; el reloj de audio no |
| `songState.hasScore` | El cursor OSMD no debe pasearse sobre partituras que no corresponden (MIDI, sesiones restauradas) |
| Solo `noteOn` alimenta los números romanos | Al soltar notas se forman acordes fantasma (C→C5) que ensuciaban la progresión |
| El ejercicio de oído consume la nota antes que el wait mode | Una respuesta de oído no debe contar como acierto/fallo de la lección |
| Snapshot de sesión guarda `origMidi` | Guardar dos veces no debe acumular la transposición |

## Testing (3 capas)

```
npm test           171 unitarias + humo N1 · ~6s · cero deps · sin red
npm run smoke      13 escenarios en Chromium headless (humo + a11y) · ~35s · necesita CDN
                   + 3 condicionados a hardware MIDI (skip limpio sin teclado)
npm run smoke:yamaha            solo los de hardware, navegador visible
YAMAHA_LIVE=1 npm run smoke:yamaha   añade el interactivo (tocar una tecla)
```

- **Unitarias**: el harness (`test/harness.js`) extrae el `<script>` del HTML y lo evalúa
  en `vm` con stubs de DOM — el HTML permanece intacto. Un epílogo exporta los símbolos
  internos (lista `EXPORTS`). Reloj controlable vía `__setNow(ms)`.
- **Humo N1** (`test/humo.test.js`): integridad HTML↔JS — todo `getElementById` del script
  existe como `id` en el HTML, todo `onclick` apunta a una función real.
- **Humo N2** (`smoke/`): Chromium de verdad. Ya encontró 2 bugs reales (zona muerta de
  1px entre teclas; validó la extracción de digitaciones de OSMD).

Regla de la casa: **cada bug se corrige con su test de regresión primero en rojo**.

---

## Auditoría de precisión y calidad (evaluación honesta)

Contexto de la pregunta: ¿cómo calificaría esta herramienta una auditoría técnica para uso
en una institución musical exigente (p. ej. una filarmónica)? Respuesta corta: **como
herramienta pedagógica: notable. Como fuente de sonido o reproductor de precisión
profesional: no califica hoy, y es honesto documentar por qué.**

### Calificación por dimensión

| Dimensión | Estado actual | Grado | Nota |
|---|---|---|---|
| **Precisión del metrónomo** | Programado en el reloj del hardware de audio (lookahead scheduler) | **Profesional** | Jitter esperado < 1ms; es la parte más sólida |
| **Latencia al tocar (modo Yamaha)** | El sonido lo produce el propio instrumento; la app solo refleja visuales | **Profesional** | La latencia audible es la del PSR-E363 (~0) |
| **Latencia al tocar (modo PC)** | MIDI-in → JS → Tone.triggerAttack → buffer de salida del navegador | **Consumo** | 15-40ms típicos según SO/buffer; un pianista exigente lo nota (objetivo pro: <10ms) |
| **Timing del autoplay** | Loop de `requestAnimationFrame`: los note-on se cuantizan al frame (~16.7ms) y los note-off usan `setTimeout` | **Consumo** | Suficiente para aprender; insuficiente para reproducción crítica (objetivo pro: programar en el reloj de audio, como el metrónomo) |
| **Precisión de la grabadora** | Timestamps con `performance.now()` en el handler | **Edu/Consumo** | Jitter del event loop 1-5ms; para análisis rítmico forense habría que usar `e.timeStamp` del evento MIDI |
| **Calidad del sonido (samples)** | Salamander Grand del CDN de Tone.js: **mp3, una sola capa de velocity**, muestras cada tercera menor con pitch-shift interpolado | **Educativa** | El Salamander original es WAV 48kHz con 16 capas; la versión CDN es una reducción. Los 19 instrumentos extra son samples comunitarios de calidad variable |
| **Reverb** | `Tone.Reverb` sintética generada | **Educativa** | Sin respuestas de impulso reales (está en backlog P1) |
| **Polifonía/estabilidad** | Sin límite de voces ni voice-stealing | **Sin medir** | Piezas densas + pedal podrían acumular voces (estrés no cuantificado) |
| **Fiabilidad MIDI** | Hot-plug, anti-eco, banks por canal, detección de arpeggio | **Sólida** | Trabajada contra hardware real; los edge cases conocidos tienen manejo |

### Métricas propuestas (las que pediría una auditoría)

1. **Latencia de ida** (tecla → sonido audible), modo PC:
   media y p95 en ms. Instrumentable hoy mismo: `Tone.context.baseLatency + outputLatency`
   como estimación; medición real con micrófono + loopback. Objetivo edu ≤ 25ms · pro ≤ 10ms.
2. **Jitter del autoplay**: desviación entre `note.time` teórico y el instante real del
   trigger (`Tone.now()` al disparo). Reportar media/p95 sobre una pieza de 500+ notas.
   Actual estimado: media ~8ms, p95 ~17ms (cuantización de frame). Objetivo pro ≤ 3ms —
   requiere migrar el autoplay a scheduling por reloj de audio (misma técnica que el metrónomo).
3. **Precisión inter-click del metrónomo**: grabar N clicks con `Tone.Offline`/loopback y
   medir desviación del período. Esperado < 1ms (verificaría la afirmación).
4. **Exactitud de captura de la grabadora**: comparar `e.timeStamp` (reloj del evento MIDI)
   vs el `performance.now()` del handler; p95 del delta. Si > 5ms, migrar a `e.timeStamp`.
5. **Estabilidad bajo carga**: frames perdidos del rAF y glitches de audio (`AudioContext`
   underruns) reproduciendo una pieza de 2.000+ notas con falling notes activas. Objetivo: 0 glitches, ≥ 55fps.
6. **Pérdida de eventos MIDI en ráfagas**: inyectar 100+ eventos/s (arpeggios rápidos) y
   verificar 0 notas perdidas o colgadas.
7. **Ficha de calidad de audio** (checklist, no métrica): formato/kHz/capas de velocity de
   cada set de samples, rango dinámico efectivo, comportamiento del release con pedal.

### Camino a "grado profesional" (si algún día se quisiera)

En orden de impacto: (1) **HECHO 2026-08-09** — autoplay programado en el reloj de audio
(lookahead 120ms + `triggerAttackRelease` + timestamps Web MIDI): jitter 29.5→**2.28ms de
media, objetivo pro cumplido**; (2) samples Salamander completos en local (WAV multi-capa,
sin CDN); (3) reverb por convolución con IRs reales (backlog P1); (4) grabadora sobre
`e.timeStamp`; (5) suite de métricas automatizada como capa 4 del testing.
También HECHO: modo rendimiento con auto-detección de fps (18→55 fps bajo carga; el
perfilado demostró que el costo era el compositor glass, no el canvas: 0.22ms/frame).

Para el caso de uso real de este proyecto — **aprender piano con un PSR-E363** — el modo
Yamaha ya ofrece latencia y sonido del instrumento físico, que es el techo de calidad
posible; las limitaciones de arriba aplican al modo PC y a la reproducción automática.

---

## Roadmap

Ver `BACKLOG.md`. Estado al 2026-08-09: **P0 completo · P2 completo** (acordes, escalas,
círculo de quintas, romanos, oído) · manos separadas, transposición, digitaciones,
drag&drop, IndexedDB, mezclador, atajos, grabadora v1 · 28 commits · 133 tests en 3 capas.
