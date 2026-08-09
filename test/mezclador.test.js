/**
 * Tests del mezclador (Sprint C): clamping de valores y canales válidos.
 * El efecto audible (dB en Tone) no se puede probar sin audio real; lo que
 * sí se protege es que un valor loco nunca corrompa el estado.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('valores fuera de rango se recortan a 0-100', () => {
  const p = loadPiano();
  p.setMixVolume('lesson', 150);
  assert.equal(p.mixVolumes.lesson, 100);
  p.setMixVolume('lesson', -20);
  assert.equal(p.mixVolumes.lesson, 0);
  p.setMixVolume('metro', '45');
  assert.equal(p.mixVolumes.metro, 45, 'strings numéricos de sliders se aceptan');
  p.setMixVolume('piano', 'basura');
  assert.equal(p.mixVolumes.piano, 0, 'no-numérico cae a 0, no a NaN');
});

test('canal desconocido se ignora sin tocar los demás', () => {
  const p = loadPiano();
  const before = { ...p.mixVolumes };
  p.setMixVolume('bajo', 50);
  assert.deepEqual({ ...p.mixVolumes }, before);
  assert.ok(!('bajo' in p.mixVolumes));
});

test('defaults: metrónomo nace más bajo que el piano (70 vs 100)', () => {
  const p = loadPiano();
  assert.equal(p.mixVolumes.piano, 100);
  assert.equal(p.mixVolumes.metro, 70);
  assert.equal(p.mixVolumes.lesson, 100);
});
