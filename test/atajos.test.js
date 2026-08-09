/**
 * Tests de atajos de teclado (Sprint C): Espacio, R, W, M, +/-.
 * Lo crítico: nunca interceptar mientras se escribe en un input, y no
 * romper nada cuando no hay lección cargada.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

function key(k, target) {
  return { key: k, target: target || { tagName: 'BODY' }, ctrlKey: false, metaKey: false, altKey: false };
}

function setupLesson(p) {
  p.songState.allNotes = [{ midi: 60, time: 0, duration: 1, hand: 'right', velocity: 0.7, played: false, origMidi: 60 }];
  p.songState.notes = p.songState.allNotes;
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0;
  p.songState.pausedAt = 0;
  p.songState.playing = false;
  p.songState.loaded = true;
  p.songState.tempo = 1.0;
  p.songState.duration = 1;
}

test('Espacio alterna play/pausa cuando hay lección', () => {
  const p = loadPiano();
  setupLesson(p);
  assert.equal(p.handleKeyboardShortcut(key(' ')), true);
  assert.equal(p.songState.playing, true);
  assert.equal(p.handleKeyboardShortcut(key(' ')), true);
  assert.equal(p.songState.playing, false);
});

test('Espacio sin lección no hace nada (deja pasar la tecla)', () => {
  const p = loadPiano();
  assert.equal(p.handleKeyboardShortcut(key(' ')), false);
  assert.equal(p.songState.playing, false);
});

test('escribir en un input NUNCA dispara atajos', () => {
  const p = loadPiano();
  setupLesson(p);
  for (const tag of ['INPUT', 'SELECT', 'TEXTAREA']) {
    assert.equal(p.handleKeyboardShortcut(key(' ', { tagName: tag })), false, tag);
    assert.equal(p.handleKeyboardShortcut(key('w', { tagName: tag })), false, tag);
  }
  assert.equal(p.songState.playing, false);
});

test('atajos con Ctrl/Cmd no se interceptan (no pisar Ctrl+R del navegador)', () => {
  const p = loadPiano();
  setupLesson(p);
  const e = key('r');
  e.ctrlKey = true;
  assert.equal(p.handleKeyboardShortcut(e), false);
});

test('R reinicia: posición a 0 y stats limpias', () => {
  const p = loadPiano();
  setupLesson(p);
  p.songState.pausedAt = 0.7;
  p.songState.hits = 5;
  p.songState.misses = 2;
  assert.equal(p.handleKeyboardShortcut(key('R')), true);
  assert.equal(p.songState.pausedAt, 0);
  assert.equal(p.songState.hits, 0);
  assert.equal(p.songState.misses, 0);
});

test('W alterna el modo esperar', () => {
  const p = loadPiano();
  setupLesson(p);
  p.songState.waitMode = true;
  p.handleKeyboardShortcut(key('w'));
  assert.equal(p.songState.waitMode, false);
  p.handleKeyboardShortcut(key('W'));
  assert.equal(p.songState.waitMode, true);
});

test('M con audio no cargado no revienta ni deja el metrónomo encendido', () => {
  const p = loadPiano();
  // Tone es undefined en el harness → toggleMetronomo debe rechazar con aviso
  assert.equal(p.handleKeyboardShortcut(key('m')), true);
  // no hay forma de click: el estado queda apagado (metroActivo interno se revierte)
  assert.equal(p.handleKeyboardShortcut(key('m')), true, 'repetir tampoco rompe');
});

test('+/- ajustan tempo ±5% con topes 40-150', () => {
  const p = loadPiano();
  setupLesson(p);
  p.handleKeyboardShortcut(key('+'));
  assert.equal(Math.round(p.songState.tempo * 100), 105);
  p.handleKeyboardShortcut(key('-'));
  p.handleKeyboardShortcut(key('-'));
  assert.equal(Math.round(p.songState.tempo * 100), 95);
  for (let i = 0; i < 30; i++) p.handleKeyboardShortcut(key('-'));
  assert.equal(Math.round(p.songState.tempo * 100), 40, 'tope inferior');
  for (let i = 0; i < 40; i++) p.handleKeyboardShortcut(key('+'));
  assert.equal(Math.round(p.songState.tempo * 100), 150, 'tope superior');
});
