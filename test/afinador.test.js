/**
 * Tests del núcleo DSP del afinador (detección de pitch YIN).
 * No usan micrófono: verifican la MATEMÁTICA con señales sintetizadas — si
 * esto está bien, lo único que el mic real aporta es ruido del mundo.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

const SR = 48000;
const N = 4096;

function seno(freq, amp = 0.5) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) b[i] = amp * Math.sin(2 * Math.PI * freq * i / SR);
  return b;
}

/** Onda tipo-piano: fundamental + armónicos decrecientes (2º y 3º fuertes). */
function pianoLike(freq, amp = 0.4) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = 2 * Math.PI * freq * i / SR;
    b[i] = amp * (Math.sin(t) + 0.55 * Math.sin(2 * t) + 0.3 * Math.sin(3 * t) + 0.12 * Math.sin(4 * t));
  }
  return b;
}

/** Ruido determinista (hash), sin Math.random → cero flakes. */
function ruido(amp) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    b[i] = amp * ((x - Math.floor(x)) * 2 - 1);
  }
  return b;
}

test('senos puros: A4=440 y C4=261.63 se detectan con precisión de cents', () => {
  const p = loadPiano();
  const a4 = p.freqToNoteInfo(p.detectPitchYIN(seno(440), SR).freq);
  assert.equal(a4.midi, 69);
  assert.ok(Math.abs(a4.cents) <= 2, 'A4 a ±2 cents (' + a4.cents + ')');
  const c4 = p.freqToNoteInfo(p.detectPitchYIN(seno(261.63), SR).freq);
  assert.equal(c4.midi, 60);
  assert.ok(Math.abs(c4.cents) <= 2, 'C4 a ±2 cents');
});

test('onda tipo-piano con armónicos fuertes: SIN error de octava', () => {
  const p = loadPiano();
  for (const [freq, midi] of [[220, 57], [261.63, 60], [440, 69], [110, 45]]) {
    const r = p.detectPitchYIN(pianoLike(freq), SR);
    assert.ok(r, 'detecta ' + freq + 'Hz');
    assert.equal(p.freqToNoteInfo(r.freq).midi, midi,
      freq + 'Hz debe dar midi ' + midi + ' (la fundamental, no el 2º armónico)');
  }
});

test('desafinación: 445Hz se reporta como A4 ~+20 cents', () => {
  const p = loadPiano();
  const info = p.freqToNoteInfo(p.detectPitchYIN(seno(445), SR).freq);
  assert.equal(info.midi, 69);
  assert.ok(info.cents >= 17 && info.cents <= 22, '+19.6¢ teóricos, medido ' + info.cents);
});

test('registro grave: A1 (55Hz) aún se detecta con la ventana de 4096', () => {
  const p = loadPiano();
  const r = p.detectPitchYIN(pianoLike(55, 0.5), SR);
  assert.ok(r, 'A1 detectado');
  assert.equal(p.freqToNoteInfo(r.freq).midi, 33);
});

test('silencio y nivel ínfimo: null (puerta de RMS)', () => {
  const p = loadPiano();
  assert.equal(p.detectPitchYIN(new Float32Array(N), SR), null, 'silencio');
  assert.equal(p.detectPitchYIN(seno(440, 0.003), SR), null, 'por debajo de la puerta');
});

test('ruido sin periodicidad: null (umbral YIN)', () => {
  const p = loadPiano();
  assert.equal(p.detectPitchYIN(ruido(0.3), SR), null);
});

test('freqToNoteInfo: mapeo exacto de la escala', () => {
  const p = loadPiano();
  assert.deepEqual({ m: p.freqToNoteInfo(440).midi, c: p.freqToNoteInfo(440).cents }, { m: 69, c: 0 });
  assert.equal(p.freqToNoteInfo(880).midi, 81, 'octava arriba');
  assert.equal(p.freqToNoteInfo(27.5).midi, 21, 'A0');
  assert.equal(p.freqToNoteInfo(4186).midi, 108, 'C8');
});
