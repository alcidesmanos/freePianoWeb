/**
 * Tests del cuantizador (P4 "Camino A"): snap a la grilla del metrónomo.
 * A 120 bpm el pulso dura 0.5s → corchea cada 0.25s, semicorchea cada 0.125s,
 * swing con el contratiempo a los 2/3 del pulso (0.3333s).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + ' (' + a + ' ≈ ' + b + ')');
const nota = (time, midi = 60) => ({ midi, time, duration: 0.2, velocity: 0.7, hand: 'right' });

test('corcheas 1/8 a 120bpm: cada nota cae al tick de 0.25s más cercano', () => {
  const p = loadPiano();
  const out = p.quantizeNotes([nota(0.02), nota(0.26), nota(0.61), nota(0.87), nota(0.92)], 120, '8');
  cerca(out[0].time, 0.0, 'casi en el pulso → al pulso');
  cerca(out[1].time, 0.25, 'contratiempo temprano → contratiempo');
  cerca(out[2].time, 0.5, 'tarde tras el pulso → al pulso');
  cerca(out[3].time, 0.75, '0.87 está más cerca del contratiempo 0.75 (Δ0.12) que del pulso 1.0 (Δ0.13)');
  cerca(out[4].time, 1.0, '0.92 sí cruza al SIGUIENTE pulso');
});

test('semicorcheas 1/16: grilla más fina', () => {
  const p = loadPiano();
  const out = p.quantizeNotes([nota(0.13), nota(0.49), nota(0.66)], 120, '16');
  cerca(out[0].time, 0.125, '0.13 → semicorchea 0.125');
  cerca(out[1].time, 0.5, '0.49 → pulso siguiente');
  cerca(out[2].time, 0.625, '0.66 → 0.625 (Δ0.035 vs Δ0.09 de 0.75)');
});

test('swing: una corchea recta se convierte en swing (contratiempo a 2/3)', () => {
  const p = loadPiano();
  const out = p.quantizeNotes([nota(0.0), nota(0.25), nota(0.5), nota(0.75)], 120, 'swing');
  cerca(out[0].time, 0.0, 'el pulso no se mueve');
  cerca(out[1].time, 0.5 * 2 / 3, 'la corchea recta SE ATRASA al tresillo');
  cerca(out[2].time, 0.5, 'segundo pulso');
  cerca(out[3].time, 0.5 + 0.5 * 2 / 3, 'y su contratiempo también');
});

test('off devuelve copias con el timing intacto y sin mutar el original', () => {
  const p = loadPiano();
  const orig = [nota(0.137), nota(0.421)];
  const out = p.quantizeNotes(orig, 120, 'off');
  cerca(out[0].time, 0.137, 'timing humano intacto');
  out[0].time = 999;
  cerca(orig[0].time, 0.137, 'el original nunca se muta');
});

test('los campos musicales sobreviven al snap (velocity, mano, dedo)', () => {
  const p = loadPiano();
  const out = p.quantizeNotes([{ midi: 64, time: 0.26, duration: 0.4, velocity: 0.9, hand: 'left', finger: 3 }], 120, '8');
  cerca(out[0].time, 0.25, 'snap aplicado');
  assert.equal(out[0].midi, 64);
  assert.equal(out[0].velocity, 0.9);
  assert.equal(out[0].hand, 'left');
  assert.equal(out[0].finger, 3);
  assert.equal(out[0].duration, 0.4, 'la duración no se toca en v1');
});

test('acorde humano desparramado queda perfectamente vertical', () => {
  const p = loadPiano();
  // tres notas "a la vez" con 40ms de desparrame humano
  const out = p.quantizeNotes([nota(0.49, 60), nota(0.51, 64), nota(0.53, 67)], 120, '8');
  cerca(out[0].time, 0.5, '');
  cerca(out[1].time, 0.5, '');
  cerca(out[2].time, 0.5, 'las tres al mismo tick = acorde exacto');
});

test('integración: cuantizar la toma, cambiar de grilla y deshacer', () => {
  const p = loadPiano();
  p.setBPM(120);
  p.toggleRecording();
  p.__setNow(1000); p.noteOn(60, 90);   // t=0
  p.__setNow(1200); p.noteOff(60);
  p.__setNow(1270); p.noteOn(64, 90);   // t=0.27 (corchea humana tardía)
  p.__setNow(1400); p.noteOff(64);
  p.stopRecording();

  p.setTakeQuantize('8');
  cerca(p.recState.take.notes[1].time, 0.25, 'toma cuantizada a corcheas');
  assert.equal(p.recState.take.quant, '8');

  p.setTakeQuantize('16');
  cerca(p.recState.take.notes[1].time, 0.25, 're-cuantizada DESDE la cruda (0.27→0.25), sin error acumulado');

  p.setTakeQuantize('off');
  cerca(p.recState.take.notes[1].time, 0.27, 'deshacer restaura el timing humano exacto');
  cerca(p.recState.take.raw[1].time, 0.27, 'la copia cruda nunca cambió');
});

test('cuantizar sin toma avisa y no revienta', () => {
  const p = loadPiano();
  p.setTakeQuantize('16');
  assert.equal(p.recState.take, null);
});
