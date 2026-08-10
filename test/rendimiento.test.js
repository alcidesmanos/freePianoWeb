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

test('modo Sencillo: alterna la clase, el botón y cierra las herramientas abiertas', () => {
  const p = loadPiano();
  p.setUiMode('full');
  assert.equal(p.__body.classList.contains('ui-simple'), false);
  assert.equal(p.__getElement('btn-ui-mode').textContent, 'Menos ▴');
  // abre una herramienta y simplifica: debe cerrarse
  p.__getElement('sound-section').classList.remove('hidden');
  p.setUiMode('simple');
  assert.equal(p.__body.classList.contains('ui-simple'), true);
  assert.equal(p.__getElement('btn-ui-mode').textContent, 'Más ▾');
  assert.equal(p.__getElement('sound-section').classList.contains('hidden'), true,
    'las secciones de herramientas se pliegan al simplificar');
  // toggle invierte
  p.toggleUiMode();
  assert.equal(p.__body.classList.contains('ui-simple'), false);
});

test('modo Sencillo apaga la captura del oído y libera el mic al simplificar', () => {
  const p = loadPiano();
  p.setUiMode('full');
  p.__getElement('ear-section').classList.remove('hidden');
  p.earState.active = true;
  p.setUiMode('simple');
  assert.equal(p.earState.active, false, 'el oído no puede quedar capturando notas oculto');
  assert.equal(p.__getElement('ear-section').classList.contains('hidden'), true);
});
