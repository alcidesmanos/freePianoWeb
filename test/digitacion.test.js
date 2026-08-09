/**
 * Tests de digitaciones desde MusicXML (Sprint B, Learning Lever #3):
 * extracción del <fingering> vía las estructuras de OSMD y propagación al
 * highlight del wait mode. Regla de oro: si el archivo no trae digitación,
 * el campo NO existe — nunca se inventa una.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

function fixtureVE(notes) {
  return {
    Notes: notes,
    parentStaffEntry: { parentStaff: { idInMusicSheet: 0 } },
  };
}

test('extracción: note.Fingering con value válido → finger en la nota', () => {
  const p = loadPiano();
  const acc = [];
  const ve = fixtureVE([
    { Pitch: { frequency: 440 }, Length: { RealValue: 0.25 }, Fingering: { value: '3' } },
  ]);
  p._extractFromVoiceEntry(ve, 0, 0.5, 2, acc);
  assert.equal(acc[0].finger, 3);
});

test('extracción: TechnicalInstructions del voice entry, asociada por sourceNote', () => {
  const p = loadPiano();
  const acc = [];
  const n1 = { Pitch: { frequency: 261.63 }, Length: { RealValue: 0.25 } }; // C4
  const n2 = { Pitch: { frequency: 329.63 }, Length: { RealValue: 0.25 } }; // E4
  const ve = fixtureVE([n1, n2]);
  ve.TechnicalInstructions = [
    { sourceNote: n1, value: '1' },
    { sourceNote: n2, value: '3' },
  ];
  p._extractFromVoiceEntry(ve, 0, 0.5, 2, acc);
  const c4 = acc.find(n => n.midi === 60);
  const e4 = acc.find(n => n.midi === 64);
  assert.equal(c4.finger, 1, 'cada nota del acorde recibe SU dedo');
  assert.equal(e4.finger, 3);
});

test('extracción: instrucción sin sourceNote solo aplica si la entrada tiene una nota', () => {
  const p = loadPiano();
  const acc = [];
  const single = fixtureVE([{ Pitch: { frequency: 440 }, Length: { RealValue: 0.25 } }]);
  single.TechnicalInstructions = [{ value: '2' }];
  p._extractFromVoiceEntry(single, 0, 0.5, 2, acc);
  assert.equal(acc[0].finger, 2, 'una nota + una instrucción = asignación directa');

  const acc2 = [];
  const chord = fixtureVE([
    { Pitch: { frequency: 261.63 }, Length: { RealValue: 0.25 } },
    { Pitch: { frequency: 329.63 }, Length: { RealValue: 0.25 } },
  ]);
  chord.TechnicalInstructions = [{ value: '2' }];
  p._extractFromVoiceEntry(chord, 0, 0.5, 2, acc2);
  assert.ok(acc2.every(n => n.finger === undefined),
    'acorde con instrucción ambigua: mejor no adivinar');
});

test('extracción: valores inválidos (fuera de 1-5) se descartan', () => {
  const p = loadPiano();
  for (const bad of ['7', '0', 'x', '12', '']) {
    const acc = [];
    const ve = fixtureVE([
      { Pitch: { frequency: 440 }, Length: { RealValue: 0.25 }, Fingering: { value: bad } },
    ]);
    p._extractFromVoiceEntry(ve, 0, 0.5, 2, acc);
    assert.equal(acc[0].finger, undefined, `"${bad}" no es un dedo válido`);
  }
});

test('extracción: sin digitación en el archivo → el campo no existe', () => {
  const p = loadPiano();
  const acc = [];
  const ve = fixtureVE([{ Pitch: { frequency: 440 }, Length: { RealValue: 0.25 } }]);
  p._extractFromVoiceEntry(ve, 0, 0.5, 2, acc);
  assert.ok(!('finger' in acc[0]), 'nunca inventar digitación');
});

test('wait mode: highlightedFingers refleja los dedos del próximo grupo', () => {
  const p = loadPiano();
  p.songState.allNotes = [
    { midi: 60, time: 0, duration: 0.5, hand: 'right', finger: 1, velocity: 0.7, played: false },
    { midi: 64, time: 0, duration: 0.5, hand: 'right', finger: 3, velocity: 0.7, played: false },
    { midi: 48, time: 0, duration: 0.5, hand: 'left', velocity: 0.7, played: false }, // sin dedo
  ];
  p.songState.notes = p.songState.allNotes;
  p.songState.groups = p.buildGroups(p.songState.notes);
  p.songState.nextGroup = 0;
  p.songState.waitMode = true;
  p.songState.loaded = true;
  p.updateHighlight();
  assert.equal(p.highlightedFingers[60], 1);
  assert.equal(p.highlightedFingers[64], 3);
  assert.equal(p.highlightedFingers[48], undefined, 'nota sin dedo no muestra badge');
  // al avanzar de grupo, los dedos anteriores se limpian
  p.songState.nextGroup = 1;
  p.updateHighlight();
  assert.equal(Object.keys(p.highlightedFingers).length, 0);
});
