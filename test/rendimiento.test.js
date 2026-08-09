/**
 * Tests del modo rendimiento (auditoría #5): la clase perf-mode gobierna los
 * efectos de cristal y la elección queda persistida y respetada.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('activar/desactivar aplica la clase perf-mode al body', () => {
  const p = loadPiano();
  p.setPerfMode(true, true);
  assert.equal(p.__body.classList.contains('perf-mode'), true);
  assert.equal(p.__getElement('chk-perf').checked, true, 'el interruptor ⚡ refleja el estado');
  p.setPerfMode(false, true);
  assert.equal(p.__body.classList.contains('perf-mode'), false);
  assert.equal(p.__getElement('chk-perf').checked, false);
});

test('valores raros se normalizan a booleano', () => {
  const p = loadPiano();
  p.setPerfMode('sí', true);
  assert.equal(p.__body.classList.contains('perf-mode'), true);
  p.setPerfMode(0, true);
  assert.equal(p.__body.classList.contains('perf-mode'), false);
});
