/**
 * Tests de la biblioteca de escalas (P2): teoría musical de las 12 formas
 * y validación del estado del selector.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

const sorted = set => [...set].sort((a, b) => a - b);

test('C mayor: las 7 notas correctas, sin alteraciones', () => {
  const p = loadPiano();
  assert.deepEqual(sorted(p.getScalePitchClasses(0, 'major')), [0, 2, 4, 5, 7, 9, 11]);
});

test('G mayor incluye F# (y solo ese sostenido)', () => {
  const p = loadPiano();
  const g = sorted(p.getScalePitchClasses(7, 'major'));
  assert.deepEqual(g, [0, 2, 4, 6, 7, 9, 11]);
  assert.ok(g.includes(6), 'F# presente');
  assert.ok(!g.includes(5), 'F natural ausente');
});

test('relativas: A menor natural y D dórico = mismas teclas que C mayor', () => {
  const p = loadPiano();
  const cMajor = sorted(p.getScalePitchClasses(0, 'major'));
  assert.deepEqual(sorted(p.getScalePitchClasses(9, 'minor')), cMajor, 'Am relativa');
  assert.deepEqual(sorted(p.getScalePitchClasses(2, 'dorian')), cMajor, 'D dórico modal');
});

test('menor armónica: séptima elevada respecto a la natural', () => {
  const p = loadPiano();
  const natural = p.getScalePitchClasses(9, 'minor');          // A menor: G natural (7)
  const armonica = p.getScalePitchClasses(9, 'harmonic-minor'); // A menor arm: G# (8)
  assert.ok(natural.has(7) && !natural.has(8));
  assert.ok(armonica.has(8) && !armonica.has(7));
});

test('pentatónicas de 5 notas y blues de 6 (con blue note)', () => {
  const p = loadPiano();
  assert.equal(p.getScalePitchClasses(0, 'major-pent').size, 5);
  assert.equal(p.getScalePitchClasses(0, 'minor-pent').size, 5);
  const blues = p.getScalePitchClasses(0, 'blues');
  assert.equal(blues.size, 6);
  assert.ok(blues.has(6), 'la blue note (F#/Gb en C) está');
});

test('parámetros inválidos devuelven null', () => {
  const p = loadPiano();
  assert.equal(p.getScalePitchClasses(0, 'klingon'), null);
  assert.equal(p.getScalePitchClasses(15, 'major'), null);
  assert.equal(p.getScalePitchClasses(-1, 'major'), null);
});

test('el selector valida: tónica o tipo inválidos no corrompen el estado', () => {
  const p = loadPiano();
  p.setScaleRoot(7);
  p.setScaleType('blues');
  assert.equal(p.scaleState.rootPc, 7);
  assert.equal(p.scaleState.shapeId, 'blues');
  p.setScaleRoot(99);
  p.setScaleType('inexistente');
  assert.equal(p.scaleState.rootPc, 7, 'tónica inválida ignorada');
  assert.equal(p.scaleState.shapeId, 'blues', 'tipo inválido ignorado');
});

test('activar/desactivar y etiqueta legible', () => {
  const p = loadPiano();
  p.setScaleRoot(9);
  p.setScaleType('minor');
  p.setScaleActive(true);
  assert.equal(p.scaleState.active, true);
  assert.equal(p.currentScaleLabel(), 'A Menor natural (eólico)');
  p.setScaleActive(false);
  assert.equal(p.scaleState.active, false);
});

test('las 12 formas declaradas empiezan en la tónica (intervalo 0)', () => {
  const p = loadPiano();
  assert.equal(p.SCALE_SHAPES.length, 12);
  for (const s of p.SCALE_SHAPES) {
    assert.equal(s.intervals[0], 0, s.id + ' debe empezar en la tónica');
    assert.ok(s.intervals.every(iv => iv >= 0 && iv < 12), s.id + ': intervalos en una octava');
    assert.equal(new Set(s.intervals).size, s.intervals.length, s.id + ': sin duplicados');
  }
});
