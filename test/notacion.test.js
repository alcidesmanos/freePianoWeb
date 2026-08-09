/**
 * Tests de notación: nombres de nota, geometría del teclado, posiciones en
 * el mini pentagrama y extracción de lección desde estructuras OSMD (fixtures).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano, plain } = require('./harness');

test('getNoteInfo: nombre EN/ES, octava y color de tecla', () => {
  const p = loadPiano();
  assert.deepEqual(plain(p.getNoteInfo(60)), { en: 'C', es: 'Do', oct: 4, isBlack: false });
  assert.deepEqual(plain(p.getNoteInfo(61)), { en: 'C#', es: 'Do#', oct: 4, isBlack: true });
  assert.deepEqual(plain(p.getNoteInfo(21)), { en: 'A', es: 'La', oct: 0, isBlack: false });
  assert.deepEqual(plain(p.getNoteInfo(108)), { en: 'C', es: 'Do', oct: 8, isBlack: false });
});

test('whiteIndex: índice de tecla blanca en el teclado de 88', () => {
  const p = loadPiano();
  assert.equal(p.whiteIndex(21), 0, 'A0 es la primera blanca');
  assert.equal(p.whiteIndex(60), 23, 'C4 = blanca 24 (índice 23)');
  assert.equal(p.whiteIndex(108), 51, 'C8 es la blanca 52 (índice 51)');
});

test('midiToToneName: formato que espera Tone.Sampler', () => {
  const p = loadPiano();
  assert.equal(p.midiToToneName(60), 'C4');
  assert.equal(p.midiToToneName(61), 'C#4');
  assert.equal(p.midiToToneName(69), 'A4');
  assert.equal(p.midiToToneName(21), 'A0');
});

test('staffYFromMidi: posiciones clave en el pentagrama doble', () => {
  const p = loadPiano();
  // Treble: B4 en la línea media (y=36); E4 en la línea inferior (y=52)
  assert.deepEqual(plain(p.staffYFromMidi(71)), { y: 36, useTreble: true });
  assert.deepEqual(plain(p.staffYFromMidi(64)), { y: 52, useTreble: true });
  // C4 (middle C): primera ledger line bajo el treble (y=60)
  assert.deepEqual(plain(p.staffYFromMidi(60)), { y: 60, useTreble: true });
  // Bass: D3 en la línea media (y=94); B3 justo sobre la primera línea
  assert.deepEqual(plain(p.staffYFromMidi(50)), { y: 94, useTreble: false });
  assert.deepEqual(plain(p.staffYFromMidi(59)), { y: 74, useTreble: false });
  // El split treble/bass es exactamente en C4
  assert.equal(p.staffYFromMidi(60).useTreble, true);
  assert.equal(p.staffYFromMidi(59).useTreble, false);
});

// ---- Extracción desde OSMD con fixtures planos (sin cargar OSMD) ----

function fixtureVoiceEntry(noteProps, staffId) {
  return {
    Notes: [noteProps],
    parentStaffEntry: { parentStaff: { idInMusicSheet: staffId } },
  };
}

test('_extractFromVoiceEntry: nota con frequency → midi, duración y mano', () => {
  const p = loadPiano();
  const acc = [];
  const ve = fixtureVoiceEntry(
    { Pitch: { frequency: 440 }, Length: { RealValue: 0.25 } }, // A4, negra
    1, // staff 2 → mano izquierda cuando numParts ≤ 2
  );
  p._extractFromVoiceEntry(ve, 2.0, 0.5, 2, acc); // quarterDurSec=0.5 (120bpm)
  assert.equal(acc.length, 1);
  assert.deepEqual(plain(acc[0]), {
    midi: 69, time: 2.0, duration: 0.5, velocity: 0.7, hand: 'left',
  });
});

test('_extractFromVoiceEntry: staff 1 → mano derecha', () => {
  const p = loadPiano();
  const acc = [];
  const ve = fixtureVoiceEntry(
    { Pitch: { frequency: 523.25 }, Length: { RealValue: 0.125 } }, // C5, corchea
    0,
  );
  p._extractFromVoiceEntry(ve, 0, 0.5, 2, acc);
  assert.equal(acc[0].midi, 72);
  assert.equal(acc[0].hand, 'right');
  assert.equal(acc[0].duration, 0.25);
});

test('_extractFromVoiceEntry: silencios y notas fuera de rango se descartan', () => {
  const p = loadPiano();
  const acc = [];
  p._extractFromVoiceEntry(fixtureVoiceEntry({ isRestNote: true }, 0), 0, 0.5, 2, acc);
  p._extractFromVoiceEntry(fixtureVoiceEntry({ Pitch: { frequency: 20 } }, 0), 0, 0.5, 2, acc); // < A0
  p._extractFromVoiceEntry(fixtureVoiceEntry({ Pitch: null }, 0), 0, 0.5, 2, acc);
  assert.equal(acc.length, 0);
});

test('_extractFromVoiceEntry: fallback FundamentalNote+Octave sin frequency', () => {
  const p = loadPiano();
  const acc = [];
  // C4 en el sistema de OSMD: fundamental=0 (C), octave=3 → (3+1)*12+0 = 48? No:
  // el código hace (octave+1)*12 + STEP_TO_MIDI[fundamental] + accidental.
  // Para obtener midi 60 (C4) se necesita octave=4.
  const ve = fixtureVoiceEntry(
    { Pitch: { FundamentalNote: 0, Octave: 4, AccidentalHalfTones: 1 }, Length: { RealValue: 0.25 } },
    0,
  );
  p._extractFromVoiceEntry(ve, 0, 0.5, 2, acc);
  assert.equal(acc[0].midi, 61, 'C4 + sostenido = 61');
});
