/**
 * Tests de detección de acordes en tiempo real (P2): teoría musical del
 * identificador puro (detectChord) e integración con noteOn/noteOff y el
 * pedal de sustain.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('tríadas básicas en posición fundamental', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([60, 64, 67]).label, 'C');
  assert.equal(p.detectChord([57, 60, 64]).label, 'Am');
  assert.equal(p.detectChord([62, 65, 68]).label, 'Ddim');
  assert.equal(p.detectChord([60, 64, 68]).label, 'Caug');
  assert.equal(p.detectChord([60, 65, 67]).label, 'Csus4');
  assert.equal(p.detectChord([60, 62, 67]).label, 'Csus2');
});

test('séptimas y extensiones', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([55, 59, 62, 65]).label, 'G7');
  assert.equal(p.detectChord([60, 64, 67, 71]).label, 'Cmaj7');
  assert.equal(p.detectChord([62, 65, 69, 72]).label, 'Dm7');
  assert.equal(p.detectChord([59, 62, 65, 69]).label, 'Bm7b5');
  assert.equal(p.detectChord([60, 63, 66, 69]).label, 'Cdim7');
  assert.equal(p.detectChord([60, 62, 64, 67, 70]).label, 'C9');
});

test('inversiones se nombran como slash chords', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([64, 67, 72]).label, 'C/E', 'primera inversión');
  assert.equal(p.detectChord([67, 72, 76]).label, 'C/G', 'segunda inversión');
});

test('ambigüedad C6 vs Am7: decide la nota del bajo', () => {
  const p = loadPiano();
  // mismas 4 pitch classes (C E G A); la fundamental en el bajo gana
  assert.equal(p.detectChord([60, 64, 67, 69]).label, 'C6', 'bajo C → C6');
  assert.equal(p.detectChord([57, 60, 64, 67]).label, 'Am7', 'bajo A → Am7');
});

test('octavas dobladas no cambian el acorde', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([48, 60, 64, 67, 72]).label, 'C');
});

test('modo español nombra con Do Re Mi', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([60, 64, 67], 'es').label, 'Do');
  assert.equal(p.detectChord([57, 60, 64], 'es').label, 'Lam');
  assert.equal(p.detectChord([64, 67, 72], 'es').label, 'Do/Mi');
});

test('dos notas: solo el power chord se identifica', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([60, 67]).label, 'C5', 'quinta justa = power chord');
  assert.equal(p.detectChord([60, 64]), null, 'una tercera sola no es acorde');
});

test('casos sin acorde: nada, una nota, octavas, cluster desconocido', () => {
  const p = loadPiano();
  assert.equal(p.detectChord([]), null);
  assert.equal(p.detectChord([60]), null);
  assert.equal(p.detectChord([48, 60, 72]), null, 'octavas de la misma nota');
  assert.equal(p.detectChord([60, 61, 62]), null, 'cluster cromático');
});

test('integración: tocar un acorde lo muestra; soltarlo lo oculta', () => {
  const p = loadPiano();
  const el = p.__getElement('chord-display');
  p.noteOn(60, 80);
  p.noteOn(64, 80);
  assert.equal(el.classList.contains('show'), false, 'una tercera aún no es acorde');
  p.noteOn(67, 80);
  assert.equal(el.classList.contains('show'), true);
  assert.equal(el.textContent, 'C');
  p.noteOff(64);
  assert.equal(el.textContent, 'C5', 'sin la tercera queda el power chord');
  p.noteOff(60);
  p.noteOff(67);
  assert.equal(el.classList.contains('show'), false);
});

test('integración: el pedal de sustain retiene notas para la detección', () => {
  const p = loadPiano();
  const el = p.__getElement('chord-display');
  p.setSustain(true);
  p.noteOn(60, 80);
  p.noteOn(64, 80);
  p.noteOff(64);              // soltada pero el pedal la retiene
  p.noteOn(67, 80);
  assert.equal(el.textContent, 'C', 'la nota sostenida sigue contando');
  assert.equal(el.classList.contains('show'), true);
  p.setSustain(false);        // pedal arriba → la retenida desaparece
  assert.equal(el.textContent, 'C5', 'quedan solo las presionadas (C y G)');
});
