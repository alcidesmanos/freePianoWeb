/**
 * Tests de persistencia de sesión (Sprint C): la foto que se guarda en
 * IndexedDB debe restaurar la práctica EXACTAMENTE como quedó — pieza,
 * transposición, filtro de manos, tempo y ajustes. El roundtrip pasa por
 * loadSong real, así que también cubre la carga de lecciones completa.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano, plain } = require('./harness');

const SNAP = {
  v: 1,
  song: {
    name: 'Für Elise',
    bpm: 72,
    notes: [
      { midi: 76, time: 0.0, duration: 0.4, velocity: 0.7, hand: 'right', finger: 4 },
      { midi: 75, time: 0.4, duration: 0.4, velocity: 0.7, hand: 'right' },
      { midi: 45, time: 0.8, duration: 0.8, velocity: 0.6, hand: 'left' },
    ],
  },
  transpose: 2,
  handFilter: 'right',
  tempoPct: 80,
  waitMode: false,
  modoNota: true,
  bpmMetro: 96,
};

test('aplicar una sesión restaura pieza, transposición, filtro y tempo', () => {
  const p = loadPiano();
  assert.equal(p.applySessionSnapshot(SNAP), true);
  assert.equal(p.songState.loaded, true);
  assert.equal(p.songState.name, 'Für Elise');
  assert.equal(p.songState.bpm, 72);
  assert.equal(p.songState.transpose, 2);
  assert.deepEqual(p.songState.allNotes.map(n => n.midi), [78, 77, 47],
    'las notas quedan transpuestas +2 al restaurar');
  assert.equal(p.songState.handFilter, 'right');
  assert.equal(p.songState.notes.length, 2, 'el filtro de mano quedó aplicado');
  assert.equal(Math.round(p.songState.tempo * 100), 80);
  assert.equal(p.songState.waitMode, false);
  assert.equal(p.songState.allNotes[0].finger, 4, 'la digitación sobrevive al guardado');
});

test('roundtrip: re-capturar la sesión devuelve las notas ORIGINALES (origMidi)', () => {
  const p = loadPiano();
  p.applySessionSnapshot(SNAP);
  const again = p.buildSessionSnapshot();
  assert.deepEqual(plain(again.song.notes), SNAP.song.notes,
    'guardar de nuevo no acumula la transposición sobre las notas');
  assert.equal(again.transpose, 2);
  assert.equal(again.handFilter, 'right');
  assert.equal(again.tempoPct, 80);
  assert.equal(again.song.name, 'Für Elise');
});

test('snapshots inválidos devuelven false sin tocar el estado', () => {
  const p = loadPiano();
  for (const bad of [null, undefined, {}, { song: {} }, { song: { notes: [] } }, { song: { notes: 'x' } }]) {
    assert.equal(p.applySessionSnapshot(bad), false);
  }
  assert.equal(p.songState.loaded, false);
});

test('campos corruptos se ignoran en vez de romper la restauración', () => {
  const p = loadPiano();
  const corrupto = {
    ...SNAP,
    transpose: 99,          // fuera del límite ±12 → ignorar
    handFilter: 'zurda',    // inválido → ignorar
    tempoPct: 9000,         // se recorta al rango 40-150
    bpmMetro: 'rápido',     // no numérico → ignorar
  };
  assert.equal(p.applySessionSnapshot(corrupto), true);
  assert.equal(p.songState.transpose, 0, 'transposición absurda ignorada');
  assert.deepEqual(p.songState.allNotes.map(n => n.midi), [76, 75, 45]);
  assert.equal(p.songState.handFilter, 'both');
  assert.equal(Math.round(p.songState.tempo * 100), 150, 'tempo recortado al tope');
});

test('filtro guardado para una mano que la pieza no tiene → both', () => {
  const p = loadPiano();
  const snap = {
    song: { name: 'Melodía', bpm: 80, notes: [
      { midi: 72, time: 0, duration: 0.5, velocity: 0.7, hand: 'right' },
    ] },
    handFilter: 'left',
  };
  p.applySessionSnapshot(snap);
  assert.equal(p.songState.handFilter, 'both');
  assert.equal(p.songState.notes.length, 1);
});

test('sin lección cargada no hay nada que guardar (null)', () => {
  const p = loadPiano();
  assert.equal(p.buildSessionSnapshot(), null);
});

test('lecciones sin partitura propia no activan score-following', () => {
  const p = loadPiano();
  // una sesión restaurada solo trae notas (nunca la partitura renderizada)
  p.applySessionSnapshot(SNAP);
  assert.equal(p.songState.hasScore, false,
    'el cursor OSMD no debe avanzar sobre una partitura que no corresponde');
});

test('markLessonWithoutScore limpia el visor y lo explica', () => {
  const p = loadPiano();
  p.songState.hasScore = true; // simula que había un XML anterior
  p.markLessonWithoutScore('Cancion.mid');
  assert.equal(p.songState.hasScore, false);
  const sl = p.__getElement('score-loading');
  assert.match(sl.textContent, /no incluye partitura/);
  assert.equal(sl.style.display, 'block');
  const st = p.__getElement('score-title');
  assert.equal(st.textContent, 'Cancion.mid · sin partitura');
});
