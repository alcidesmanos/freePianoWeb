/**
 * Tests del enrutado de archivos soltados (Sprint C, drag & drop):
 * la clasificación por extensión decide si un drop va al parser MIDI o al
 * pipeline MusicXML — equivocarse aquí manda un binario al parser XML.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

test('extensiones MIDI → ruta midi (case-insensitive)', () => {
  const p = loadPiano();
  assert.equal(p.classifyPianoFile('cancion.mid'), 'midi');
  assert.equal(p.classifyPianoFile('cancion.midi'), 'midi');
  assert.equal(p.classifyPianoFile('FUR_ELISE.MID'), 'midi');
});

test('extensiones MusicXML → ruta xml', () => {
  const p = loadPiano();
  assert.equal(p.classifyPianoFile('partitura.xml'), 'xml');
  assert.equal(p.classifyPianoFile('partitura.musicxml'), 'xml');
  assert.equal(p.classifyPianoFile('partitura.mxl'), 'xml');
  assert.equal(p.classifyPianoFile('Chopin Nocturne Op9No2.MXL'), 'xml');
});

test('lo demás se rechaza (null), incluidos casos traicioneros', () => {
  const p = loadPiano();
  assert.equal(p.classifyPianoFile('audio.mp3'), null);
  assert.equal(p.classifyPianoFile('documento.pdf'), null);
  assert.equal(p.classifyPianoFile('sin-extension'), null);
  assert.equal(p.classifyPianoFile(''), null);
  assert.equal(p.classifyPianoFile(null), null);
  assert.equal(p.classifyPianoFile('cancion.mid.zip'), null, 'la extensión real es .zip');
  assert.equal(p.classifyPianoFile('xml'), null, 'nombre sin punto no es extensión');
});
