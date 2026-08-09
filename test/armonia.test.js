/**
 * Tests del análisis armónico (P2): grados romanos con la convención correcta
 * y la progresión rodante alimentada por acordes tocados de verdad.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('grados diatónicos de C mayor con la convención de mayúsculas/minúsculas', () => {
  const p = loadPiano();
  assert.equal(p.romanNumeralFor(0, '', 0), 'I');
  assert.equal(p.romanNumeralFor(2, 'm', 0), 'ii');
  assert.equal(p.romanNumeralFor(4, 'm', 0), 'iii');
  assert.equal(p.romanNumeralFor(5, '', 0), 'IV');
  assert.equal(p.romanNumeralFor(7, '', 0), 'V');
  assert.equal(p.romanNumeralFor(9, 'm', 0), 'vi');
  assert.equal(p.romanNumeralFor(11, 'dim', 0), 'vii°');
});

test('séptimas: V7, ii7, IVmaj7, vii°7, semidisminuido ø7', () => {
  const p = loadPiano();
  assert.equal(p.romanNumeralFor(7, '7', 0), 'V7');
  assert.equal(p.romanNumeralFor(2, 'm7', 0), 'ii7');
  assert.equal(p.romanNumeralFor(5, 'maj7', 0), 'IVmaj7');
  assert.equal(p.romanNumeralFor(11, 'dim7', 0), 'vii°7');
  assert.equal(p.romanNumeralFor(11, 'm7b5', 0), 'viiø7');
  assert.equal(p.romanNumeralFor(0, 'aug', 0), 'I+');
});

test('la tonalidad importa: el mismo acorde cambia de grado', () => {
  const p = loadPiano();
  assert.equal(p.romanNumeralFor(2, '', 2), 'I', 'D mayor en Re = tónica');
  assert.equal(p.romanNumeralFor(2, '', 7), 'V', 'D mayor en Sol = dominante');
  assert.equal(p.romanNumeralFor(2, 'm', 0), 'ii', 'D menor en Do = segundo grado');
});

test('acordes prestados: raíces cromáticas con bemol (bVII, bVI, bIII)', () => {
  const p = loadPiano();
  assert.equal(p.romanNumeralFor(10, '', 0), 'bVII', 'Bb en C — el prestado del rock');
  assert.equal(p.romanNumeralFor(8, '', 0), 'bVI');
  assert.equal(p.romanNumeralFor(3, '', 0), 'bIII');
});

test('sin tonalidad conocida no hay grado', () => {
  const p = loadPiano();
  assert.equal(p.romanNumeralFor(0, '', null), null);
  assert.equal(p.currentKeyPc(), null, 'sin escala activa ni detección → null');
});

test('currentKeyPc: la escala fijada manda; menor usa su relativa mayor', () => {
  const p = loadPiano();
  p.setScaleRoot(7);
  p.setScaleType('major');
  p.setScaleActive(true);
  assert.equal(p.currentKeyPc(), 7, 'G mayor');
  p.setScaleRoot(9);
  p.setScaleType('minor');
  assert.equal(p.currentKeyPc(), 0, 'A menor analiza como C mayor (relativa)');
});

test('integración: tocar I–V–vi–IV en C construye la progresión completa', () => {
  const p = loadPiano();
  p.setScaleRoot(0); p.setScaleType('major'); p.setScaleActive(true);
  const el = p.__getElement('roman-display');
  const tocarAcorde = midis => { midis.forEach(m => p.noteOn(m, 80)); midis.forEach(m => p.noteOff(m)); };
  tocarAcorde([60, 64, 67]);  // C
  tocarAcorde([55, 59, 62]);  // G
  tocarAcorde([57, 60, 64]);  // Am
  tocarAcorde([53, 57, 60]);  // F
  assert.equal(el.textContent, 'I – V – vi – IV');
  assert.equal(el.classList.contains('show'), true);
  tocarAcorde([55, 59, 62]);  // G otra vez → la ventana rueda
  assert.equal(el.textContent, 'V – vi – IV – V');
});

test('integración: completar un acorde refina el grado en vez de duplicarlo', () => {
  const p = loadPiano();
  p.setScaleRoot(0); p.setScaleType('major'); p.setScaleActive(true);
  const el = p.__getElement('roman-display');
  p.noteOn(60, 80);           // C sola: nada
  p.noteOn(67, 80);           // C+G = power chord → 'I5'
  assert.equal(el.textContent, 'I5');
  p.noteOn(64, 80);           // + E = C mayor completo → se refina a 'I'
  assert.equal(el.textContent, 'I', 'no queda I5 – I duplicado');
  [60, 64, 67].forEach(m => p.noteOff(m));
  assert.equal(el.textContent, 'I', 'soltar notas no reescribe la progresión');
});
