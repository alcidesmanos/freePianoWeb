/**
 * Pruebas de humo Nivel 1: la costura HTML ↔ JS que las unitarias no ven.
 *
 * 1. Todo getElementById('x') literal del script tiene su id="x" en el HTML
 *    (los guards if(el) se tragan estos typos en runtime, sin error visible).
 * 2. Todo onclick/onchange/oninput del HTML llama a una función que existe.
 * 3. Sanidad del documento: CDNs esperados, inputs file con accept correcto.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const path = require('path');

const html = readFileSync(path.join(__dirname, '..', 'piano_pro.html'), 'utf8');
const script = (html.match(/<script>([\s\S]*)<\/script>/) || [, ''])[1];
assert.ok(script.length > 1000, 'el script inline debe existir');

// ids creados por JS en runtime (no están en el HTML estático)
const DYNAMIC_IDS = new Set(['cf-center-label']);

test('todo getElementById literal apunta a un id existente en el HTML', () => {
  const htmlIds = new Set();
  for (const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);

  const referenced = new Set();
  for (const m of script.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    referenced.add(m[1]);
  }
  assert.ok(referenced.size > 30, 'sanity: el script referencia muchos ids (' + referenced.size + ')');

  const missing = [...referenced].filter(id => !htmlIds.has(id) && !DYNAMIC_IDS.has(id));
  assert.deepEqual(missing, [],
    'ids referenciados en JS que NO existen en el HTML: ' + missing.join(', '));
});

test('ids con prefijo dinámico (hand-, mix-) existen para todos sus sufijos', () => {
  const htmlIds = new Set();
  for (const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);
  // getElementById('hand-'+h) / ('mix-'+c) / ('mix-'+c+'-val') no son
  // capturables por regex de literales: se verifican explícitamente.
  for (const h of ['both', 'left', 'right']) {
    assert.ok(htmlIds.has('hand-' + h), 'falta id hand-' + h);
  }
  for (const c of ['piano', 'metro', 'lesson']) {
    assert.ok(htmlIds.has('mix-' + c), 'falta id mix-' + c);
    assert.ok(htmlIds.has('mix-' + c + '-val'), 'falta id mix-' + c + '-val');
  }
});

test('todo handler onclick/onchange/oninput del HTML llama a una función definida', () => {
  const handlers = new Set();
  for (const m of html.matchAll(/on(?:click|change|input)="([^"]+)"/g)) {
    const call = m[1].match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
    if (call) handlers.add(call[1]); // asignaciones tipo "x.y=this.checked" se omiten
  }
  assert.ok(handlers.size > 15, 'sanity: hay muchos handlers (' + handlers.size + ')');

  const missing = [...handlers].filter(name =>
    !new RegExp('(?:^|[\\s;}])(?:async\\s+)?function\\s+' + name + '\\s*\\(').test(script));
  assert.deepEqual(missing, [],
    'handlers del HTML sin función en el script: ' + missing.join(', '));
});

test('las 4 librerías CDN esperadas están declaradas', () => {
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(srcs.length, 4);
  for (const lib of ['tone@', '@tonejs/midi', 'jszip', 'opensheetmusicdisplay']) {
    assert.ok(srcs.some(s => s.includes(lib)), 'falta CDN de ' + lib);
  }
});

test('inputs de archivo aceptan las extensiones que el código enruta', () => {
  const midiAccept = html.match(/id="midi-input"[^>]*accept="([^"]+)"/) || html.match(/accept="([^"]+)"[^>]*id="midi-input"/);
  assert.ok(midiAccept && midiAccept[1].includes('.mid'), 'midi-input debe aceptar .mid');
  const xmlAccept = html.match(/id="xml-input"[^>]*accept="([^"]+)"/) || html.match(/accept="([^"]+)"[^>]*id="xml-input"/);
  for (const ext of ['.xml', '.musicxml', '.mxl']) {
    assert.ok(xmlAccept && xmlAccept[1].includes(ext), 'xml-input debe aceptar ' + ext);
  }
});
