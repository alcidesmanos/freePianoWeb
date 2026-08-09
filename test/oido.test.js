/**
 * Tests del entrenamiento de oído (P2): generación de ejercicios, evaluación
 * de respuestas y la integración con noteOn — incluida la regla de que un
 * ejercicio en curso NO contamina los aciertos de la lección.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('generación: tamaños y modos correctos por nivel, siempre dentro del piano', () => {
  const p = loadPiano();
  const esperado = { intervals: [2, 'melodic'], triads: [3, 'chord'], sevenths: [4, 'chord'] };
  for (const [level, [size, mode]] of Object.entries(esperado)) {
    for (let i = 0; i < 50; i++) {
      const ex = p.generateEarExercise(level);
      assert.equal(ex.midis.length, size, level);
      assert.equal(ex.mode, mode, level);
      assert.ok(ex.midis.every(m => m >= 21 && m <= 108), level + ' en rango de piano');
      assert.ok(ex.label.length > 0, level + ' con etiqueta para Revelar');
    }
  }
  for (let i = 0; i < 50; i++) {
    const ex = p.generateEarExercise('scales');
    assert.ok(ex.midis.length >= 6 && ex.midis.length <= 8, 'escala: 5-7 notas + octava');
    assert.equal(ex.midis[ex.midis.length - 1], ex.midis[0] + 12, 'termina en la octava de la tónica');
    assert.equal(ex.mode, 'melodic');
  }
  assert.equal(p.generateEarExercise('klingon'), null);
});

test('evaluación de acordes: mismas notas en cualquier orden', () => {
  const p = loadPiano();
  const ex = { midis: [60, 64, 67], mode: 'chord' };
  assert.equal(p.earAnswerMatches(ex, [60]), 'pending');
  assert.equal(p.earAnswerMatches(ex, [67, 60, 64]), 'correct', 'el orden no importa');
  assert.equal(p.earAnswerMatches(ex, [60, 64, 68]), 'wrong');
  assert.equal(p.earAnswerMatches(ex, [60, 60, 64]), 'pending', 'nota repetida no completa el acorde');
  assert.equal(p.earAnswerMatches(ex, [60, 64, 67, 70]), 'wrong', 'nota extra invalida');
});

test('evaluación melódica: la secuencia exacta importa', () => {
  const p = loadPiano();
  const ex = { midis: [60, 67], mode: 'melodic' };
  assert.equal(p.earAnswerMatches(ex, [60]), 'pending');
  assert.equal(p.earAnswerMatches(ex, [60, 67]), 'correct');
  assert.equal(p.earAnswerMatches(ex, [67, 60]), 'wrong', 'al revés no vale — así no sonó');
});

test('integración: responder bien por noteOn suma acierto y racha', () => {
  const p = loadPiano();
  p.earState.active = true;
  p.earState.exercise = { midis: [60, 64], mode: 'melodic', label: '3ª mayor desde C4' };
  p.earState.awaiting = true;
  p.noteOn(60, 80);
  assert.equal(p.earState.awaiting, true, 'a mitad sigue esperando');
  p.noteOn(64, 80);
  assert.equal(p.earState.correct, 1);
  assert.equal(p.earState.attempts, 1);
  assert.equal(p.earState.streak, 1);
  assert.equal(p.earState.awaiting, false);
  const status = p.__getElement('ear-status');
  assert.match(status.textContent, /Correcto/);
});

test('integración: fallar resetea la racha y permite reintentar el MISMO ejercicio', () => {
  const p = loadPiano();
  p.earState.active = true;
  p.earState.streak = 3;
  p.earState.exercise = { midis: [60, 67], mode: 'melodic', label: '5ª justa desde C4' };
  p.earState.awaiting = true;
  p.noteOn(60, 80);
  p.noteOn(65, 80); // era 67
  assert.equal(p.earState.streak, 0);
  assert.equal(p.earState.attempts, 1);
  assert.equal(p.earState.correct, 0);
  assert.equal(p.earState.awaiting, true, 'sigue esperando el reintento');
  assert.equal(p.earState.capture.length, 0, 'captura limpia para reintentar');
});

test('un ejercicio en curso NO contamina los aciertos de la lección', () => {
  const p = loadPiano();
  // lección cargada en wait mode cuya próxima tecla es C4 (60)
  p.songState.allNotes = [{ midi: 60, time: 0, duration: 0.5, hand: 'right', velocity: 0.7, played: false, origMidi: 60 }];
  p.songState.notes = p.songState.allNotes;
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0; p.songState.hits = 0; p.songState.misses = 0;
  p.songState.waitMode = true; p.songState.loaded = true;
  // y un ejercicio de oído esperando justamente un C4
  p.earState.active = true;
  p.earState.exercise = { midis: [60, 64], mode: 'melodic', label: 'x' };
  p.earState.awaiting = true;
  p.noteOn(60, 80);
  assert.equal(p.songState.hits, 0, 'la nota fue respuesta del oído, no de la lección');
  assert.equal(p.songState.misses, 0);
  // sin ejercicio activo, la misma nota SÍ va a la lección
  p.earState.awaiting = false;
  p.earState.exercise = null;
  p.noteOn(60, 80);
  assert.equal(p.songState.hits, 1);
});

test('revelar sin responder cuenta como intento fallido y muestra la respuesta', () => {
  const p = loadPiano();
  p.earState.active = true;
  p.earState.exercise = { midis: [60, 64, 67], mode: 'chord', label: 'C (C4)' };
  p.earState.awaiting = true;
  p.earState.streak = 5;
  p.revealEarExercise();
  assert.equal(p.earState.attempts, 1);
  assert.equal(p.earState.streak, 0, 'rendirse rompe la racha');
  assert.equal(p.earState.awaiting, false);
  assert.match(p.__getElement('ear-status').textContent, /Era: C \(C4\)/);
  // revelar dos veces no duplica el intento
  p.revealEarExercise();
  assert.equal(p.earState.attempts, 1);
});

test('setEarLevel valida y resetea el ejercicio en curso', () => {
  const p = loadPiano();
  p.earState.exercise = { midis: [60], mode: 'melodic', label: 'x' };
  p.earState.awaiting = true;
  p.setEarLevel('triads');
  assert.equal(p.earState.level, 'triads');
  assert.equal(p.earState.exercise, null);
  assert.equal(p.earState.awaiting, false);
  p.setEarLevel('inexistente');
  assert.equal(p.earState.level, 'triads', 'nivel inválido ignorado');
});

test('toggle activa/desactiva la captura', () => {
  const p = loadPiano();
  p.__getElement('ear-section').classList.add('hidden');
  p.toggleEarTraining();
  assert.equal(p.earState.active, true);
  p.toggleEarTraining();
  assert.equal(p.earState.active, false);
});
