/**
 * Tests del círculo de quintas (P2): detector de tonalidad por histograma,
 * coherencia de la geometría musical (mayor ↔ relativa menor) y el click
 * que fija la escala.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

/** Cuenta pitch classes de una lista de midis. */
function counts(midis) {
  const c = Array(12).fill(0);
  midis.forEach(m => c[m % 12]++);
  return c;
}

test('detector: la escala de C mayor se identifica como C', () => {
  const p = loadPiano();
  const cMajor = [60, 62, 64, 65, 67, 69, 71, 72, 60, 64, 67];
  assert.equal(p.detectKeyFromCounts(counts(cMajor)).majorPc, 0);
});

test('detector: G mayor (con F#) se distingue de C', () => {
  const p = loadPiano();
  const gMajor = [67, 69, 71, 72, 74, 76, 78, 79, 67, 71, 74];
  assert.equal(p.detectKeyFromCounts(counts(gMajor)).majorPc, 7);
});

test('detector: F mayor (con Bb) → F', () => {
  const p = loadPiano();
  const fMajor = [65, 67, 69, 70, 72, 74, 76, 77, 65, 69, 72];
  assert.equal(p.detectKeyFromCounts(counts(fMajor)).majorPc, 5);
});

test('detector: melodía en La menor cae en el segmento C/Am (relativas)', () => {
  const p = loadPiano();
  // énfasis en A y E (tónica y dominante de Am), todas notas de C mayor
  const aMinor = [57, 60, 64, 65, 64, 62, 60, 59, 57, 57, 64, 69];
  assert.equal(p.detectKeyFromCounts(counts(aMinor)).majorPc, 0,
    'Am comparte segmento con C mayor');
});

test('detector: con menos de 6 notas no opina', () => {
  const p = loadPiano();
  assert.equal(p.detectKeyFromCounts(counts([60, 64, 67])), null);
  assert.equal(p.detectKeyFromCounts(counts([])), null);
});

test('geometría musical: cada etiqueta menor es la relativa de su mayor', () => {
  const p = loadPiano();
  const PC = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
  assert.equal(p.CIRCLE_ORDER.length, 12);
  assert.equal(new Set(p.CIRCLE_ORDER).size, 12, 'los 12 pc sin repetir');
  for (let i = 0; i < 12; i++) {
    const majPc = PC[p.CIRCLE_LABELS_MAJ[i]];
    const minPc = PC[p.CIRCLE_LABELS_MIN[i].replace(/m$/, '')];
    assert.equal(majPc, p.CIRCLE_ORDER[i], p.CIRCLE_LABELS_MAJ[i] + ' está en su posición');
    assert.equal(minPc, (majPc + 9) % 12, p.CIRCLE_LABELS_MIN[i] + ' es la relativa de ' + p.CIRCLE_LABELS_MAJ[i]);
  }
  // y el orden es de quintas: cada paso suma 7 semitonos
  for (let i = 1; i < 12; i++) {
    assert.equal(p.CIRCLE_ORDER[i], (p.CIRCLE_ORDER[i - 1] + 7) % 12, 'paso ' + i + ' es una quinta');
  }
});

test('integración: tocar una escala actualiza la tonalidad mostrada', () => {
  const p = loadPiano();
  const el = p.__getElement('circle-detected');
  [67, 69, 71, 72, 74, 76, 78, 79].forEach(m => { p.noteOn(m, 80); p.noteOff(m); });
  assert.equal(el.textContent, 'tonalidad: G · Em');
});

test('click en un segmento fija la escala correspondiente', () => {
  const p = loadPiano();
  p.onCircleClick(9, true); // anillo interior: Am
  assert.equal(p.scaleState.rootPc, 9);
  assert.equal(p.scaleState.shapeId, 'minor');
  assert.equal(p.scaleState.active, true);
  p.onCircleClick(7, false); // anillo exterior: G mayor
  assert.equal(p.scaleState.rootPc, 7);
  assert.equal(p.scaleState.shapeId, 'major');
});
