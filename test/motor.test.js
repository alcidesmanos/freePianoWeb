/**
 * Tests del motor de lección: agrupación, wait mode, seek, reloj de canción.
 *
 * Los tests marcados "BUG 0.x" documentan defectos reales detectados en la
 * revisión del 2026-08-09 y DEBEN FALLAR hasta que se corrijan en el HTML
 * (tolerancia de grupos 30ms vs búsquedas con 10ms).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

/** Prepara songState con notas dadas, en wait mode, listo para tocar. */
function setupLesson(p, notes) {
  p.songState.notes = notes.map(n => ({ velocity: 0.7, played: false, ...n }));
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0;
  p.songState.hits = 0;
  p.songState.misses = 0;
  p.songState.pausedAt = 0;
  p.songState.playing = false;
  p.songState.waitMode = true;
  p.songState.loaded = true;
  p.songState.tempo = 1.0;
  p.songState.duration = Math.max(...p.songState.notes.map(n => n.time + n.duration));
}

test('buildGroups: notas a ≤30ms forman un solo grupo', () => {
  const p = loadPiano();
  const groups = p.buildGroups([
    { midi: 60, time: 1.00, duration: 0.5 },
    { midi: 64, time: 1.02, duration: 0.5 },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual([...groups[0].midis].sort(), [60, 64]);
});

test('buildGroups: notas a >30ms forman grupos separados', () => {
  const p = loadPiano();
  const groups = p.buildGroups([
    { midi: 60, time: 1.00, duration: 0.5 },
    { midi: 64, time: 1.05, duration: 0.5 },
  ]);
  assert.equal(groups.length, 2);
});

test('wait mode: completar un grupo suma hits y avanza nextGroup', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 1.0, duration: 0.5, hand: 'right' },
    { midi: 64, time: 1.0, duration: 0.5, hand: 'right' },
  ]);
  assert.equal(p.registerUserHit(60, true), true);
  assert.equal(p.songState.nextGroup, 0, 'grupo incompleto no avanza');
  assert.equal(p.registerUserHit(64, true), true);
  assert.equal(p.songState.hits, 2);
  assert.equal(p.songState.nextGroup, 1, 'grupo completo avanza');
  assert.ok(p.songState.notes.every(n => n.played), 'notas exactas quedan marcadas');
});

test('wait mode: tecla fuera del grupo cuenta como fallo', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 60, time: 1.0, duration: 0.5, hand: 'right' }]);
  assert.equal(p.registerUserHit(99, true), false);
  assert.equal(p.songState.misses, 1);
  assert.equal(p.songState.hits, 0);
});

test('wait mode: repetir una nota ya tocada del grupo no re-suma hit', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 1.0, duration: 0.5, hand: 'right' },
    { midi: 64, time: 1.0, duration: 0.5, hand: 'right' },
  ]);
  p.registerUserHit(60, true);
  p.registerUserHit(60, true); // repetida: cae al else → miss
  assert.equal(p.songState.hits, 1);
  assert.equal(p.songState.misses, 1);
});

test('BUG 0.1: nota desfasada 20ms (dentro del grupo) debe marcarse played al completar', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 1.00, duration: 0.5, hand: 'right' },
    { midi: 64, time: 1.02, duration: 0.5, hand: 'right' }, // +20ms: mismo grupo (≤30ms)
  ]);
  assert.equal(p.songState.groups.length, 1, 'precondición: un solo grupo');
  p.registerUserHit(60, true);
  p.registerUserHit(64, true);
  assert.equal(p.songState.nextGroup, 1);
  const n64 = p.songState.notes.find(n => n.midi === 64);
  // FALLA HOY: el marcado usa |n.time - g.time| < 0.01 pero el grupo tolera 0.03
  assert.equal(n64.played, true,
    'la nota a +20ms pertenece al grupo pero el lookup de 10ms no la marca');
});

test('BUG 0.1b: highlight respeta la mano de una nota desfasada 20ms', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 48, time: 1.00, duration: 0.5, hand: 'right' },
    { midi: 52, time: 1.02, duration: 0.5, hand: 'left' }, // izquierda, +20ms
  ]);
  p.updateHighlight();
  assert.equal(p.highlightedKeys[48], 'right');
  // FALLA HOY: el find con tolerancia 10ms no encuentra la nota → default 'right'
  assert.equal(p.highlightedKeys[52], 'left',
    'la nota desfasada debe colorearse como mano izquierda');
});

test('seekTo: recalcula nextGroup y resetea played solo desde t', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 0.0, duration: 0.5, hand: 'right' },
    { midi: 62, time: 1.0, duration: 0.5, hand: 'right' },
    { midi: 64, time: 2.0, duration: 0.5, hand: 'right' },
  ]);
  p.songState.notes.forEach(n => { n.played = true; });
  p.songState.groups.forEach(g => g.midis.forEach(m => g.played.add(m)));
  p.seekTo(1.0);
  assert.equal(p.songState.pausedAt, 1.0);
  assert.equal(p.songState.nextGroup, 1);
  assert.equal(p.songState.notes[0].played, true, 'antes de t: se conserva');
  assert.equal(p.songState.notes[1].played, false, 'desde t: se resetea');
  assert.equal(p.songState.notes[2].played, false);
  assert.equal(p.songState.groups[1].played.size, 0);
});

test('getSongTime: avanza con performance.now() escalado por tempo', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 60, time: 0, duration: 10, hand: 'right' }]);
  p.__setNow(0);
  p.songState.pausedAt = 2.0;
  p.songState.startPerf = 0;
  p.songState.playing = true;

  p.songState.tempo = 1.0;
  p.__setNow(1000);
  assert.equal(p.getSongTime(), 3.0);

  p.songState.tempo = 0.5;
  assert.equal(p.getSongTime(), 2.5);

  p.songState.playing = false;
  assert.equal(p.getSongTime(), 2.0, 'pausado devuelve pausedAt');
});

test('setTempo: cambia velocidad sin saltar el cursor de canción', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 60, time: 0, duration: 10, hand: 'right' }]);
  p.__setNow(0);
  p.songState.pausedAt = 0;
  p.songState.startPerf = 0;
  p.songState.playing = true;
  p.__setNow(2000); // t = 2.0s a tempo 100%
  p.setTempo(50);
  assert.equal(p.songState.tempo, 0.5);
  assert.equal(p.getSongTime(), 2.0, 'el tiempo no salta al cambiar tempo');
});

test('fmtTime formatea m:ss', () => {
  const p = loadPiano();
  assert.equal(p.fmtTime(0), '0:00');
  assert.equal(p.fmtTime(61), '1:01');
  assert.equal(p.fmtTime(125.9), '2:05');
});
