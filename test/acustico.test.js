/**
 * Tests del wait mode acústico: la máquina de estados que convierte lecturas
 * continuas de pitch del micrófono en eventos de nota para la lección.
 * Reglas: 3 lecturas estables + claridad ≥0.93 emiten UNA vez; re-articular la
 * misma nota exige un "dip" (silencio o caída de energía); cooldown de 250ms
 * contra el eco del propio sampler.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

function setupMelodia(p, midis) {
  p.songState.allNotes = midis.map((m, i) => ({ midi: m, time: i, duration: 0.5, hand: 'right', velocity: 0.7, played: false, origMidi: m }));
  p.songState.handFilter = 'both';
  p.songState.notes = p.songState.allNotes;
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0;
  p.songState.hits = 0; p.songState.misses = 0;
  p.songState.waitMode = true;
  p.songState.loaded = true;
  p.songState.tempo = 1; p.songState.duration = midis.length;
  p.acousticState.active = true;
  p.acousticState.dipped = true;
  p.acousticState.lastEmit = null;
  p.acousticState.lastEmitAt = 0;
}

const det = (midi, clarity = 0.98, rms = 0.1) => ({ midi, clarity, rms });

test('3 lecturas estables emiten UNA nota que completa el grupo del wait mode', () => {
  const p = loadPiano();
  setupMelodia(p, [60, 64]);
  p.__setNow(1000);
  p._acousticFeed(det(60));
  p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 0, 'con 2 lecturas aún no');
  p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 1, 'a la 3ª lectura, hit');
  assert.equal(p.songState.nextGroup, 1);
  // la nota sigue sonando (sostenida): NO se re-emite
  for (let i = 0; i < 10; i++) p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 1, 'nota sostenida = un solo evento');
});

test('cambiar de nota emite la nueva; la melodía completa avanza la lección', () => {
  const p = loadPiano();
  setupMelodia(p, [60, 64, 67]);
  p.__setNow(1000);
  for (let i = 0; i < 3; i++) p._acousticFeed(det(60));
  p.__setNow(1500);
  for (let i = 0; i < 3; i++) p._acousticFeed(det(64));
  p.__setNow(2000);
  for (let i = 0; i < 3; i++) p._acousticFeed(det(67));
  assert.equal(p.songState.hits, 3);
  assert.equal(p.songState.nextGroup, 3, 'melodía terminada solo con el micrófono');
  assert.equal(p.songState.misses, 0);
});

test('re-articular la MISMA nota exige un dip (Für Elise repite notas)', () => {
  const p = loadPiano();
  setupMelodia(p, [60, 60]);
  p.__setNow(1000);
  for (let i = 0; i < 6; i++) p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 1, 'sostener no cuenta dos veces');
  p.__setNow(1400);
  p._acousticFeed(null);                       // silencio breve = dip
  for (let i = 0; i < 3; i++) p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 2, 'tras el dip, el re-ataque cuenta');
});

test('caída fuerte de energía también habilita el re-ataque (staccato rápido)', () => {
  const p = loadPiano();
  setupMelodia(p, [60, 60]);
  p.__setNow(1000);
  for (let i = 0; i < 3; i++) p._acousticFeed(det(60, 0.98, 0.2));
  assert.equal(p.songState.hits, 1);
  p.__setNow(1400);
  p._acousticFeed(det(60, 0.98, 0.05));        // energía cae al 25% sin silencio total
  for (let i = 0; i < 3; i++) p._acousticFeed(det(60, 0.98, 0.18));
  assert.equal(p.songState.hits, 2);
});

test('claridad baja se ignora por completo (ruido, transitorios)', () => {
  const p = loadPiano();
  setupMelodia(p, [60]);
  p.__setNow(1000);
  for (let i = 0; i < 8; i++) p._acousticFeed(det(60, 0.7));
  assert.equal(p.songState.hits, 0);
  assert.equal(p.songState.misses, 0, 'ni siquiera cuenta como fallo');
});

test('cooldown anti-eco: la nota siguiente espera 250ms pero NO se pierde', () => {
  const p = loadPiano();
  setupMelodia(p, [60, 64]);
  p.__setNow(1000);
  for (let i = 0; i < 3; i++) p._acousticFeed(det(60));   // emite a t=1000
  p.__setNow(1100);                                        // demasiado pronto
  for (let i = 0; i < 3; i++) p._acousticFeed(det(64));
  assert.equal(p.songState.hits, 1, 'bloqueada por cooldown');
  p.__setNow(1300);                                        // pasó el cooldown
  p._acousticFeed(det(64));
  assert.equal(p.songState.hits, 2, 'el reintento del siguiente tick la emite');
});

test('nota equivocada cuenta como fallo, igual que con teclado', () => {
  const p = loadPiano();
  setupMelodia(p, [60]);
  p.__setNow(1000);
  for (let i = 0; i < 3; i++) p._acousticFeed(det(65));
  assert.equal(p.songState.misses, 1);
  assert.equal(p.songState.hits, 0);
});

test('inactivo o sin wait mode: el feed no toca nada', () => {
  const p = loadPiano();
  setupMelodia(p, [60]);
  p.acousticState.active = false;
  for (let i = 0; i < 5; i++) p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 0);
  p.acousticState.active = true;
  p.songState.waitMode = false;
  for (let i = 0; i < 5; i++) p._acousticFeed(det(60));
  assert.equal(p.songState.hits, 0);
});

test('sin micrófono disponible, activar el modo falla con gracia', async () => {
  const p = loadPiano();
  await p.setAcousticMode(true);
  assert.equal(p.acousticState.active, false, 'sin mic → no queda activo a medias');
  assert.equal(p.__getElement('chk-acoustic').checked, false);
});
