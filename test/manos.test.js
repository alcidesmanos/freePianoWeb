/**
 * Tests del modo "manos separadas" (Sprint B): filtrar la lección a una sola
 * mano sin perder progreso, con reversión segura si la pieza no tiene esa mano.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

/** Lección con ambas manos, como la deja loadSong (allNotes + filtro 'both'). */
function setupLesson(p, notes) {
  p.songState.allNotes = notes.map(n => ({ velocity: 0.7, played: false, ...n }));
  p.songState.handFilter = 'both';
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
  { midi: 50, time: 1.0, duration: 0.5, hand: 'left' },
  { midi: 74, time: 2.0, duration: 0.5, hand: 'right' },
];

test('setHandFilter(right): solo la mano derecha queda en notas y grupos', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.setHandFilter('right');
  assert.equal(p.songState.handFilter, 'right');
  assert.equal(p.songState.notes.length, 2);
  assert.ok(p.songState.notes.every(n => n.hand === 'right'));
  assert.equal(p.songState.groups.length, 2, 'un grupo por nota derecha');
  // el highlight del wait mode solo propone teclas de la derecha
  assert.equal(p.highlightedKeys[72], 'right');
  assert.equal(p.highlightedKeys[48], undefined, 'la izquierda no se resalta');
});

test('setHandFilter conserva posición, stats y progreso al cambiar', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  // tocar el primer grupo completo (acorde izq+der en t=0)
  p.registerUserHit(48, true);
  p.registerUserHit(72, true);
  assert.equal(p.songState.hits, 2);
  assert.ok(p.songState.pausedAt > 0, 'avanzó tras completar el grupo');

  p.setHandFilter('right');
  assert.equal(p.songState.hits, 2, 'stats intactas');
  const past = p.songState.allNotes.filter(n => n.time === 0);
  assert.ok(past.every(n => n.played), 'lo ya tocado sigue marcado');
  // el próximo grupo es la siguiente nota DERECHA (t=2), no la izquierda de t=1
  const g = p.songState.groups[p.songState.nextGroup];
  assert.equal(g.time, 2.0);
  assert.deepEqual([...g.midis], [74]);
});

test('setHandFilter(both) restaura la pieza completa', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.setHandFilter('left');
  assert.equal(p.songState.notes.length, 2);
  p.setHandFilter('both');
  assert.equal(p.songState.handFilter, 'both');
  assert.equal(p.songState.notes.length, 4);
  assert.equal(p.songState.groups.length, 3, 'grupos de la pieza completa');
});

test('pieza sin mano izquierda: el filtro revierte a both', () => {
  const p = loadPiano();
  setupLesson(p, [
    { midi: 72, time: 0, duration: 0.5, hand: 'right' },
    { midi: 74, time: 1, duration: 0.5, hand: 'right' },
  ]);
  p.setHandFilter('left');
  assert.equal(p.songState.handFilter, 'both', 'no deja la lección vacía');
  assert.equal(p.songState.notes.length, 2);
});

test('filtro inválido cae a both', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.setHandFilter('zurda');
  assert.equal(p.songState.handFilter, 'both');
});

test('sin lección cargada no cambia nada', () => {
  const p = loadPiano();
  p.songState.loaded = false;
  p.setHandFilter('right');
  assert.equal(p.songState.handFilter, 'both');
});

test('wait mode filtrado: completar grupos de una sola mano avanza la canción', () => {
  const p = loadPiano();
  setupLesson(p, PIEZA);
  p.setHandFilter('right');
  assert.equal(p.registerUserHit(72, true), true);
  assert.equal(p.songState.nextGroup, 1);
  assert.equal(p.registerUserHit(74, true), true);
  assert.equal(p.songState.nextGroup, 2, 'lección terminada solo con la derecha');
  assert.equal(p.songState.hits, 2);
  assert.equal(p.songState.misses, 0);
});
