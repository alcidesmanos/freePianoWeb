/**
 * Harness de pruebas para piano_pro.html SIN modificar el archivo.
 *
 * Estrategia: lee el HTML, extrae el <script> inline (el motor completo)
 * y lo evalúa en un contexto vm de Node con stubs de DOM/Web APIs.
 * Un epílogo concatenado al script exporta los símbolos internos
 * (const/let no llegan al sandbox por sí solos en vm.runInNewContext).
 *
 * El HTML sigue siendo la única fuente de verdad: si una función se
 * renombra allí, solo hay que ajustar la lista EXPORTS de abajo.
 */
'use strict';

const { readFileSync } = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, '..', 'piano_pro.html');

// Símbolos internos del <script> que los tests necesitan alcanzar.
const EXPORTS = [
  // estado global del motor
  'songState', 'loopState', 'highlightedKeys', 'highlightedFingers', 'activeKeys',
  // motor de lección
  'buildGroups', 'registerUserHit', 'seekTo', 'getSongTime', 'setTempo',
  'updateHighlight', 'resetPlayedFlags', 'fmtTime', 'setHandFilter',
  'transposeSong', 'handleKeyboardShortcut', 'nudgeTempo', 'classifyPianoFile',
  'setMixVolume', 'mixVolumes',
  'buildSessionSnapshot', 'applySessionSnapshot', 'loadSong',
  // detección de acordes
  'detectChord', 'updateChordDisplay', 'noteOn', 'noteOff', 'setSustain',
  // biblioteca de escalas
  'SCALE_SHAPES', 'scaleState', 'getScalePitchClasses',
  'setScaleActive', 'setScaleRoot', 'setScaleType', 'currentScaleLabel',
  // círculo de quintas
  'detectKeyFromCounts', 'CIRCLE_ORDER', 'CIRCLE_LABELS_MAJ', 'CIRCLE_LABELS_MIN',
  'onCircleClick',
  // análisis armónico
  'romanNumeralFor', 'currentKeyPc',
  'markLessonWithoutScore',
  // entrenamiento de oído
  'EAR_LEVELS', 'earState', 'generateEarExercise', 'earAnswerMatches',
  'setEarLevel', 'toggleEarTraining', 'revealEarExercise',
  // grabadora MIDI
  'recState', 'toggleRecording', 'stopRecording', 'useTakeAsLesson', 'exportTakeAsMidi',
  // teclado / notación
  'getNoteInfo', 'whiteIndex', 'midiToToneName', 'staffYFromMidi',
  'layout', 'getMidiFromPoint',
  // integración Yamaha
  'findYamahaVoiceName', 'programToPreset', 'PRESET_TO_GM',
  'GM_INSTRUMENTS', 'PSR_E363_VOICES',
  // extracción de lección desde OSMD (testeable con fixtures planos)
  '_extractFromVoiceEntry',
];

/**
 * Objeto "agujero negro": callable, cualquier propiedad devuelve otro
 * agujero negro. Sirve como CanvasRenderingContext2D (clearRect, gradients,
 * roundRect...) sin enumerar la API entera.
 */
function makeBlackHole() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get: (target, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      return proxy;
    },
    set: () => true,
    apply: () => proxy,
  });
  return proxy;
}

/** Elemento DOM falso con classList funcional (los booleanos importan). */
function fakeEl() {
  const classes = new Set();
  const el = {
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : force;
        on ? classes.add(c) : classes.delete(c);
        return on;
      },
      contains: c => classes.has(c),
    },
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    hidden: false,
    width: 0, height: 0,
    offsetTop: 0, offsetHeight: 0, scrollTop: 0,
    clientWidth: 1200, clientHeight: 200,
    parentElement: null,
    children: [],
    files: [],
    label: '',
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    getAttribute: () => null,
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    getContext: () => makeBlackHole(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    scrollTo() {},
  };
  return el;
}

/**
 * Carga el motor de piano_pro.html en un contexto aislado.
 * @returns {object} { ...símbolos exportados, __setNow(ms) para controlar performance.now() }
 */
function loadPiano() {
  const html = readFileSync(HTML_PATH, 'utf8');
  // El único tag exactamente "<script>" (sin src) es el motor inline;
  // greedy hasta el último </script> captura su cuerpo completo.
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('No se encontró el <script> inline en piano_pro.html');
  const script = m[1];

  // Reloj controlable para tests de getSongTime/tempo
  let nowMs = 0;

  // getElementById con caché por id: el estado (classList, textContent)
  // persiste entre llamadas, como en un DOM real.
  const elements = new Map();
  const getEl = id => {
    if (!elements.has(id)) elements.set(id, fakeEl());
    return elements.get(id);
  };

  const sandbox = {
    document: {
      getElementById: getEl,
      createElement: () => fakeEl(),
      createElementNS: () => fakeEl(),
      querySelectorAll: () => [],
      addEventListener() {},
      hidden: false,
    },
    window: { addEventListener() {}, innerWidth: 1200 },
    navigator: {},
    performance: { now: () => nowMs },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    // Librerías CDN declaradas como undefined (no ausentes): así tanto los
    // guards con typeof como las referencias directas (if(Tone && ...)) se
    // comportan como "no cargada" en vez de lanzar ReferenceError.
    Tone: undefined, Midi: undefined, JSZip: undefined,
    opensheetmusicdisplay: undefined, indexedDB: undefined,
  };
  sandbox.globalThis = sandbox;

  const epilogue = ';__exports = {' + EXPORTS.join(',') + '};';
  vm.runInNewContext(script + epilogue, sandbox, { filename: 'piano_pro.html#inline-script' });

  const api = sandbox.__exports;
  api.__setNow = ms => { nowMs = ms; };
  api.__getElement = getEl; // para inspeccionar DOM falso si un test lo necesita
  return api;
}

/**
 * Normaliza un objeto creado dentro del contexto vm (otro realm) para que
 * assert.deepStrictEqual no falle por diferencia de prototipos.
 */
function plain(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = { loadPiano, plain };
