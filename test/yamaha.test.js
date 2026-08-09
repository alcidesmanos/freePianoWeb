/**
 * Tests de la integración Yamaha PSR-E363: tabla de voces, reverse lookup
 * y mapeos GM ↔ preset interno.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano, plain } = require('./harness');

test('findYamahaVoiceName: lookup exacto por Bank MSB/LSB + PC', () => {
  const p = loadPiano();
  // pcByte es 0-based (MIDI); la tabla usa 1-based (manual Yamaha)
  const grand = p.findYamahaVoiceName(0, 112, 0);
  assert.deepEqual(plain(grand), { name: 'Grand Piano', category: 'Piano *' });

  const cp80 = p.findYamahaVoiceName(0, 113, 2);
  assert.equal(cp80.name, 'CP80');
});

test('findYamahaVoiceName: banco desconocido devuelve null', () => {
  const p = loadPiano();
  assert.equal(p.findYamahaVoiceName(1, 0, 0), null);
  assert.equal(p.findYamahaVoiceName(0, 112, 127), null);
});

test('tabla PSR-E363: entradas bien formadas y sin duplicados Bank/PC', () => {
  const p = loadPiano();
  const seen = new Set();
  for (const v of p.PSR_E363_VOICES) {
    const [msb, lsb, pc1, name, cat] = v;
    assert.equal(msb, 0, name + ': MSB siempre 0 en XGlite');
    assert.ok(lsb >= 0 && lsb <= 127, name + ': LSB fuera de rango');
    assert.ok(pc1 >= 1 && pc1 <= 128, name + ': PC (1-based) fuera de rango');
    assert.ok(typeof name === 'string' && name.length, 'nombre vacío');
    assert.ok(typeof cat === 'string' && cat.length, name + ': categoría vacía');
    const key = msb + '/' + lsb + '/' + pc1;
    assert.ok(!seen.has(key), 'duplicado Bank/PC: ' + key + ' (' + name + ')');
    seen.add(key);
  }
});

test('programToPreset: familias GM se mapean al preset esperado', () => {
  const p = loadPiano();
  const casos = {
    0: 'piano', 7: 'piano',            // pianos
    13: 'xylophone',                    // percusión cromática
    16: 'organ', 21: 'harmonium',
    25: 'guitar-acoustic', 27: 'guitar-electric',
    33: 'bass-electric',
    40: 'violin', 42: 'cello', 43: 'contrabass', 46: 'harp',
    56: 'trumpet', 57: 'trombone', 58: 'tuba', 60: 'french-horn',
    65: 'saxophone', 70: 'bassoon', 71: 'clarinet', 73: 'flute',
    81: 'piano',                        // synth lead → fallback piano
    127: 'piano',                       // SFX → fallback
  };
  for (const [program, preset] of Object.entries(casos)) {
    assert.equal(p.programToPreset(+program), preset, 'GM ' + program);
  }
});

test('ida y vuelta: PRESET_TO_GM y programToPreset son consistentes', () => {
  const p = loadPiano();
  // Para cada preset interno, el GM que enviamos al Yamaha debe volver
  // a mapearse al mismo preset cuando el Yamaha lo eco-reporta.
  for (const [preset, gm] of Object.entries(p.PRESET_TO_GM)) {
    assert.equal(p.programToPreset(gm), preset,
      preset + ' → GM ' + gm + ' → ' + p.programToPreset(gm));
  }
});

test('GM_INSTRUMENTS: tabla completa de 128 programas', () => {
  const p = loadPiano();
  assert.equal(p.GM_INSTRUMENTS.length, 128);
  assert.equal(p.GM_INSTRUMENTS[0], 'Acoustic Grand Piano');
  assert.equal(p.GM_INSTRUMENTS[127], 'Gunshot');
});
