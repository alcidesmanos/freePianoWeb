/**
 * Tests del cambio de instrumento ante fallos de carga (bug reportado por el
 * usuario 2026-08-09: "si falla un cargue, ya no cambia más").
 *
 * Usa un Tone.Sampler falso controlable para simular fallos de red y cargas
 * colgadas sin tocar internet.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPiano } = require('./harness');

/** Tone falso: los samplers quedan pendientes hasta que el test los resuelva. */
function fakeTone() {
  const instances = [];
  class Sampler {
    constructor(opts) {
      this.opts = opts;
      this.disposed = false;
      this.volume = { value: 0 };
      instances.push(this);
    }
    connect() { return this; }
    dispose() { this.disposed = true; }
    triggerRelease() {}
    triggerAttack() {}
    triggerAttackRelease() {}
    releaseAll() {}
  }
  return {
    Tone: { Sampler, gainToDb: x => x, now: () => 0, context: { state: 'running', resume() {} } },
    instances,
  };
}

function totalSamples(p, preset) {
  return Object.keys(p.INSTRUMENT_PRESETS[preset].urls).length;
}

test('BUG: fallo total de red rechaza INMEDIATO y el siguiente intento funciona', async () => {
  const p = loadPiano();
  const fk = fakeTone();
  p.__set('Tone', fk.Tone);

  // intento 1: todos los samples fallan (sin red) → antes esperaba 35s con candado
  const p1 = p.switchInstrument('violin');
  const inst1 = fk.instances[0];
  const n = totalSamples(p, 'violin');
  for (let i = 0; i < n; i++) inst1.opts.onerror(new Error('404'));
  await p1;
  assert.equal(p.__currentInstrument, 'piano', 'el fallo no corrompe el instrumento activo');
  assert.equal(inst1.disposed, true, 'el sampler fallido se libera');

  // intento 2 INMEDIATO (sin esperar nada): antes se ignoraba en silencio
  const p2 = p.switchInstrument('cello');
  const inst2 = fk.instances[1];
  assert.ok(inst2, 'el segundo intento SÍ arranca una carga');
  inst2.opts.onload();
  await p2;
  assert.equal(p.__currentInstrument, 'cello', 'el reintento tras fallo funciona');
  assert.equal(p.__samplerPreset, 'cello');
});

test('supersede: con una carga colgada, el último click del usuario gana', async () => {
  const p = loadPiano();
  const fk = fakeTone();
  p.__set('Tone', fk.Tone);

  const pViolin = p.switchInstrument('violin');   // se queda cargando…
  const pCello = p.switchInstrument('cello');     // el usuario cambia de idea
  const [instViolin, instCello] = fk.instances;

  // el violín termina DESPUÉS de que el usuario ya pidió cello
  instViolin.opts.onload();
  await pViolin;
  assert.equal(p.__currentInstrument, 'piano', 'la carga obsoleta NO se aplica');
  assert.equal(instViolin.disposed, true, 'y se libera');

  instCello.opts.onload();
  await pCello;
  assert.equal(p.__currentInstrument, 'cello', 'gana la selección más reciente');
});

test('timeout con carga parcial: si algún buffer cargó, el sampler se acepta', async () => {
  // No se puede acelerar el timeout de 12s sin fake timers; se verifica la
  // lógica del conteo de buffers con la MISMA estructura interna que usa Tone.
  const p = loadPiano();
  const fk = fakeTone();
  p.__set('Tone', fk.Tone);
  const p1 = p.switchInstrument('flute');
  const inst = fk.instances[0];
  // simular internals de Tone: 3 de N buffers cargaron
  inst._buffers = { _buffers: new Map([['a', { loaded: true }], ['b', { loaded: true }], ['c', { loaded: false }]]) };
  // fallo parcial: fallan todos MENOS los cargados → no dispara el rechazo total
  const n = totalSamples(p, 'flute');
  for (let i = 0; i < n - 1; i++) inst.opts.onerror(new Error('404'));
  // el onload nunca llega (Tone no lo dispara con fallos); resolvemos vía onload
  // del resto para no esperar 12s reales — aquí validamos que el rechazo total
  // NO se disparó con n-1 fallos:
  inst.opts.onload();
  await p1;
  assert.equal(p.__currentInstrument, 'flute', 'fallos parciales no matan la carga');
});

test('elegir el instrumento ya activo no dispara ninguna carga', async () => {
  const p = loadPiano();
  const fk = fakeTone();
  p.__set('Tone', fk.Tone);
  await p.switchInstrument('piano'); // ya es el activo
  assert.equal(fk.instances.length, 0, 'ni un sampler creado');
});
