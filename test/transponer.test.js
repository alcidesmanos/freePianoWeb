/**
 * Tests de transposición (Sprint B): desplazar la pieza en semitonos con
 * origMidi como fuente de verdad, guardas de rango y convivencia con el
 * filtro de manos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

/** Lección como la deja loadSong: allNotes con origMidi, transpose 0. */
function setupLesson(p, notes) {
  p.songState.allNotes = notes.map(n => ({ velocity: 0.7, origMidi: n.midi, played: false, ...n }));
  p.songState.handFilter = 'both';
  p.songState.transpose = 0;
  p.songState.notes = p.songState.allNotes;
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0;
  p.songState.hits = 0;
  p.songState.misses = 0;
  p.songState.pausedAt = 0;
  p.songState.playing = false;
  p.songState.waitMode = true;
  p.songState.loaded = true;
  p.songState.tempo = 1.0;
  p.songState.duration = Math.max(...p.songState.allNotes.map(n => n.time + n.duration));
}

const PIEZA = [
  { midi: 48, time: 0.0, duration: 0.5, hand: 'left' },
  { midi: 72, time: 0.0, duration: 0.5, hand: 'right' },
  { midi: 74, time: 1.0, duration: 0.5, hand: 'right' },
];

test('transponer +2: midi, grupos y highlight se desplazan; origMidi queda intacto', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.transposeSong(1);
  p.transposeSong(1);
  assert.equal(p.songState.transpose, 2);
  assert.deepEqual(p.songState.allNotes.map(n => n.midi), [50, 74, 76]);
  assert.deepEqual(p.songState.allNotes.map(n => n.origMidi), [48, 72, 74]);
  assert.deepEqual([...p.songState.groups[0].midis].sort((a, b) => a - b), [50, 74]);
  assert.equal(p.highlightedKeys[50], 'left', 'el highlight pide la tecla transpuesta');
  assert.equal(p.highlightedKeys[48], undefined);
});

test('wait mode tras transponer: se toca la tecla transpuesta, no la original', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.transposeSong(1);
  assert.equal(p.registerUserHit(48, true), false, 'la tecla original ya no vale');
  assert.equal(p.registerUserHit(49, true), true, 'vale la transpuesta');
});

test('volver a 0 restaura la pieza original', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.transposeSong(1);
  p.transposeSong(-1);
  assert.equal(p.songState.transpose, 0);
  assert.deepEqual(p.songState.allNotes.map(n => n.midi), [48, 72, 74]);
});

test('guarda de rango: no deja sacar notas del piano (A0-C8)', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 108, time: 0, duration: 0.5, hand: 'right' }]); // C8, tope
  p.transposeSong(1);
  assert.equal(p.songState.transpose, 0, 'rechazado: C8+1 no existe');
  assert.equal(p.songState.allNotes[0].midi, 108);
});

test('límite ±12 semitonos', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 60, time: 0, duration: 0.5, hand: 'right' }]);
  for (let i = 0; i < 12; i++) p.transposeSong(1);
  assert.equal(p.songState.transpose, 12);
  p.transposeSong(1);
  assert.equal(p.songState.transpose, 12, 'no pasa de +12');
});

test('transposición convive con manos separadas', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.transposeSong(2);
  p.setHandFilter('right');
  assert.deepEqual(p.songState.notes.map(n => n.midi), [74, 76], 'filtradas Y transpuestas');
  p.setHandFilter('both');
  assert.equal(p.songState.notes.length, 3);
  assert.equal(p.songState.transpose, 2, 'el filtro no resetea la transposición');
});

test('sin lección cargada no hace nada', () => {
  const p = loadPiano();
  p.songState.loaded = false;
  p.transposeSong(1);
  assert.equal(p.songState.transpose, 0);
});
