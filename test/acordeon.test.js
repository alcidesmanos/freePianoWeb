/**
 * Tests del detector de pitch contra ACORDEÓN REAL (no señales sintéticas).
 *
 * Fixtures: ventanas de 4096 muestras de un acordeón sampleado (soundfont
 * MusyngKite vía midi-js-soundfonts), una por nota, con ground truth en el
 * nombre del archivo. Ver test/fixtures/acordeon/README.md para regenerarlos.
 *
 * Esto valida lo que los senos sintéticos no pueden: lengüetas libres reales
 * con sus armónicos, formantes y ruido de fuelle.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('fs');
const path = require('path');
const { loadPiano } = require('./harness');

const SR = 48000;
const NOTAS = { C3: 48, E3: 52, G3: 55, C4: 60, E4: 64, G4: 67, A4: 69, C5: 72, E5: 76, G5: 79, C6: 84 };

const HAY_FIXTURES = existsSync(path.join(__dirname, 'fixtures', 'acordeon', 'C4.f32'));
const SKIP = HAY_FIXTURES ? false : 'fixtures locales no generados (audio de origen externo, fuera del repo) — regenerar con test/fixtures/acordeon/README.md';

function fixture(name) {
  const raw = readFileSync(path.join(__dirname, 'fixtures', 'acordeon', name + '.f32'));
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

test('acordeón real: las 11 notas del registro C3-C6 se detectan exactas', { skip: SKIP }, () => {
  const p = loadPiano();
  const resultados = [];
  for (const [name, midiEsperado] of Object.entries(NOTAS)) {
    const r = p.detectPitchYIN(fixture(name), SR);
    assert.ok(r, name + ': el detector no devolvió nada');
    const info = p.freqToNoteInfo(r.freq);
    resultados.push(`${name}→midi ${info.midi} (${info.cents}¢, claridad ${r.clarity.toFixed(2)})`);
    assert.equal(info.midi, midiEsperado,
      name + ' detectado como midi ' + info.midi + ' (esperado ' + midiEsperado + ')');
    assert.ok(Math.abs(info.cents) <= 10,
      name + ': desviación ' + info.cents + '¢ excede ±10¢');
    assert.ok(r.clarity > 0.9,
      name + ': claridad ' + r.clarity.toFixed(2) + ' demasiado baja');
  }
  console.log('    ' + resultados.join('\n    '));
});

test('acordeón real: sin errores de octava en ningún registro', { skip: SKIP }, () => {
  // El error clásico de los detectores es leer el 2º armónico (una octava
  // arriba). Con lengüetas reales de armónicos ricos, verificamos que NUNCA
  // pasa: la diferencia con el esperado jamás es ±12.
  const p = loadPiano();
  for (const [name, midiEsperado] of Object.entries(NOTAS)) {
    const info = p.freqToNoteInfo(p.detectPitchYIN(fixture(name), SR).freq);
    assert.notEqual(Math.abs(info.midi - midiEsperado), 12,
      name + ': ¡error de octava!');
  }
});
