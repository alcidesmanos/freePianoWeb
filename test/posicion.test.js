/**
 * Tests de la guía de posición de manos: aritmética del span de 5 dedos
 * (anclaje al pulgar con digitaciones, estimación sin ellas, teclas negras,
 * bordes del piano) e integración con el estado de la lección.
 *
 * Referencia de índices de blancas: A0=0 · C4=23 · G4=27 · C8=51.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

function setupLesson(p, notes) {
  p.songState.allNotes = notes.map(n => ({ velocity: 0.7, played: false, origMidi: n.midi, ...n }));
  p.songState.handFilter = 'both';
  p.songState.notes = p.songState.allNotes;
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0;
  p.songState.waitMode = true;
  p.songState.loaded = true;
  p.songState.tempo = 1.0;
  p.songState.duration = Math.max(...notes.map(n => n.time + n.duration));
}

test('digitación en mano derecha: el pulgar ancla el span de 5 blancas', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 64, time: 0, duration: 0.5, hand: 'right', finger: 3 }]); // E4 con dedo 3
  const pos = p.computeHandPosition('right', 0, 0);
  // E4 (blanca 25) con dedo 3 → pulgar en C4 (23) → posición de Do: 23..27
  assert.equal(pos.thumbW, 23);
  assert.deepEqual([pos.w0, pos.w1], [23, 27]);
  assert.equal(pos.confident, true);
});

test('mano izquierda: el pulgar queda en el extremo AGUDO', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 48, time: 0, duration: 0.5, hand: 'left', finger: 5 }]); // C3 con meñique
  const pos = p.computeHandPosition('left', 0, 0);
  // C3 (blanca 16) con dedo 5 → pulgar 4 blancas ARRIBA (20 = G3) → span 16..20
  assert.equal(pos.thumbW, 20);
  assert.deepEqual([pos.w0, pos.w1], [16, 20]);
});

test('nota negra con digitación: ancla sobre la blanca inferior', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 61, time: 0, duration: 0.5, hand: 'right', finger: 2 }]); // C#4
  const pos = p.computeHandPosition('right', 0, 0);
  // C#4 → blanca de referencia C4 (23); dedo 2 → pulgar 22 (B3) → 22..26
  assert.equal(pos.thumbW, 22);
  assert.deepEqual([pos.w0, pos.w1], [22, 26]);
});

test('bordes del piano: el span se recorta a 0..51 sin romperse', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 21, time: 0, duration: 0.5, hand: 'left', finger: 5 },  // A0: blanca 0
    { midi: 108, time: 0, duration: 0.5, hand: 'right', finger: 5 }, // C8: blanca 51
  ]);
  const izq = p.computeHandPosition('left', 0, 0);
  assert.deepEqual([izq.w0, izq.w1], [0, 4], 'A0 con meñique → pulgar en la blanca 4');
  const der = p.computeHandPosition('right', 0, 0);
  assert.deepEqual([der.w0, der.w1], [47, 51], 'C8 con meñique → pulgar en la 47');
});

test('sin digitación: estima por rango, mínimo 5 blancas, marcada como ~', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 0.0, duration: 0.3, hand: 'right' },
    { midi: 62, time: 0.3, duration: 0.3, hand: 'right' },
    { midi: 64, time: 0.6, duration: 0.3, hand: 'right' },
  ]);
  const pos = p.computeHandPosition('right', 0, 0);
  assert.equal(pos.confident, false, 'sin dedos = estimación');
  assert.equal(pos.w1 - pos.w0, 4, 'ensanchada a 5 blancas');
  assert.ok(pos.w0 <= 23 && pos.w1 >= 25, 'cubre el rango C4-E4 tocado');
});

test('la primera nota CON digitación manda aunque haya anteriores sin ella', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 0.0, duration: 0.3, hand: 'right' },            // sin dedo
    { midi: 67, time: 0.3, duration: 0.3, hand: 'right', finger: 5 }, // G4 meñique
  ]);
  const pos = p.computeHandPosition('right', 0, 0);
  assert.equal(pos.confident, true);
  assert.equal(pos.thumbW, 23, 'G4 (27) con dedo 5 → pulgar C4');
});

test('integración: el filtro de manos apaga la guía de la mano excluida', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 48, time: 0, duration: 0.5, hand: 'left', finger: 1 },
    { midi: 72, time: 0, duration: 0.5, hand: 'right', finger: 1 },
  ]);
  p.setHandPosGuide(true, true);
  assert.ok(p.__handPos.left && p.__handPos.right, 'ambas manos con guía');
  p.setHandFilter('right');
  assert.equal(p.__handPos.left, null, 'la izquierda filtrada no muestra guía');
  assert.ok(p.__handPos.right);
});

test('integración: avanza con el wait mode y se apaga con el check', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 60, time: 0, duration: 0.4, hand: 'right', finger: 1 },  // posición de Do
    { midi: 72, time: 1, duration: 0.4, hand: 'right', finger: 1 },  // posición de Do5
  ]);
  p.setHandPosGuide(true, true);
  assert.equal(p.__handPos.right.thumbW, 23, 'grupo 1: pulgar en C4');
  p.registerUserHit(60, true); // completa el grupo → updateHighlight → guía
  assert.equal(p.__handPos.right.thumbW, 30, 'grupo 2: la mano se desplazó a C5');
  p.setHandPosGuide(false, true);
  assert.equal(p.__handPos.right, null, 'check apagado = sin guía');
});

test('sin notas próximas de una mano no se inventa posición', () => {
  const p = loadPiano();
  setupLesson(p, [{ midi: 72, time: 0, duration: 0.5, hand: 'right', finger: 1 }]);
  assert.equal(p.computeHandPosition('left', 0, 0), null);
});
