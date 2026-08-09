/**
 * Tests de la grabadora MIDI (P4 v1): captura con reloj controlado, cierre de
 * notas abiertas al parar, conversión a lección y guardas de la exportación.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('flujo completo: armar → tocar → parar, con tiempos exactos', () => {
  const p = loadPiano();
  p.toggleRecording();                       // arma
  assert.equal(p.recState.armed, true);
  assert.equal(p.recState.recording, false, 'aún no graba: espera la primera nota');

  p.__setNow(5000);                          // el usuario tarda 5s en empezar
  p.noteOn(60, 100);                         // primera nota → arranca el reloj AQUÍ
  assert.equal(p.recState.recording, true);
  p.__setNow(5500);
  p.noteOff(60);
  p.__setNow(6000);
  p.noteOn(64, 80);
  p.__setNow(6400);
  p.noteOff(64);
  p.__setNow(9000);
  p.stopRecording();

  const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg + ' (' + a + ' ≈ ' + b + ')');
  const take = p.recState.take;
  assert.equal(take.notes.length, 2);
  cerca(take.notes[0].time, 0, 'el silencio previo al primer toque NO se graba');
  cerca(take.notes[0].duration, 0.5, 'duración de la primera nota');
  cerca(take.notes[1].time, 1.0, 'tiempo de la segunda nota');
  cerca(take.notes[1].duration, 0.4, 'duración de la segunda nota');
  cerca(take.duration, 1.4, 'la cola de silencio tras la última nota se recorta');
  assert.ok(Math.abs(take.notes[0].velocity - 100 / 127) < 1e-9, 'velocity real preservada');
});

test('notas aún presionadas al parar se cierran con su duración', () => {
  const p = loadPiano();
  p.toggleRecording();
  p.__setNow(1000);
  p.noteOn(48, 90);                          // se queda presionada
  p.__setNow(1800);
  p.stopRecording();
  assert.equal(p.recState.take.notes.length, 1);
  assert.equal(p.recState.take.notes[0].duration, 0.8);
  assert.equal(p.recState.take.notes[0].hand, 'left', 'grave = mano izquierda');
});

test('armar y parar sin tocar = cancelación limpia, sin toma', () => {
  const p = loadPiano();
  p.toggleRecording();
  p.toggleRecording();                       // segundo toggle = parar
  assert.equal(p.recState.armed, false);
  assert.equal(p.recState.recording, false);
  assert.equal(p.recState.take, null);
});

test('sin armar, tocar NO graba nada', () => {
  const p = loadPiano();
  p.noteOn(60, 80);
  p.noteOff(60);
  assert.equal(p.recState.notes.length, 0);
  assert.equal(p.recState.recording, false);
});

test('usar la toma como lección: loadSong con las notas grabadas', () => {
  const p = loadPiano();
  p.toggleRecording();
  p.__setNow(1000); p.noteOn(60, 90);
  p.__setNow(1400); p.noteOff(60);
  p.__setNow(1500); p.noteOn(72, 85);
  p.__setNow(2000); p.noteOff(72);
  p.stopRecording();
  p.useTakeAsLesson();
  assert.equal(p.songState.loaded, true);
  assert.match(p.songState.name, /Mi grabación/);
  assert.equal(p.songState.allNotes.length, 2);
  assert.equal(p.songState.hasScore, false, 'una toma no tiene partitura');
  assert.equal(p.songState.allNotes[1].hand, 'right');
});

test('la toma sobrevive a usarla como lección (loadSong no la muta)', () => {
  const p = loadPiano();
  p.toggleRecording();
  p.__setNow(1000); p.noteOn(60, 90);
  p.__setNow(1400); p.noteOff(60);
  p.stopRecording();
  p.useTakeAsLesson();
  p.songState.allNotes[0].played = true;
  p.songState.allNotes[0].midi = 99;
  assert.equal(p.recState.take.notes[0].midi, 60, 'la lección trabaja sobre copias');
  assert.ok(!('played' in p.recState.take.notes[0]));
});

test('exportar sin toma o sin librería avisa sin romper', () => {
  const p = loadPiano();
  p.exportTakeAsMidi();                      // sin toma → warn, no crash
  p.toggleRecording();
  p.__setNow(1000); p.noteOn(60, 90);
  p.__setNow(1400); p.noteOff(60);
  p.stopRecording();
  p.exportTakeAsMidi();                      // Midi undefined en harness → error toast, no crash
  assert.ok(true, 'ninguna de las dos rutas lanzó excepción');
});
