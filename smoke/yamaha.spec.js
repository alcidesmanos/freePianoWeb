/**
 * Pruebas de humo CONDICIONADAS al hardware: solo se ejecutan de verdad si hay
 * un teclado MIDI conectado (si no, se omiten y la suite queda verde).
 *
 *   npm run smoke              → las incluye; sin teclado se marcan "skipped"
 *   npm run smoke:yamaha       → solo estas, con navegador visible
 *   YAMAHA_LIVE=1 npm run smoke:yamaha → añade el test interactivo
 *                                (te pide tocar una tecla física, 10s)
 */
'use strict';

const { test, expect } = require('@playwright/test');

test.use({ permissions: ['midi'] });

async function bootApp(page) {
  await page.goto('/piano_pro.html');
  await expect(page.locator('#splash button')).toBeVisible({ timeout: 90000 });
  await page.click('#splash button');
}

/** Enumera dispositivos MIDI reales desde dentro de la página. */
async function midiDevices(page) {
  return page.evaluate(async () => {
    if (!navigator.requestMIDIAccess) return { supported: false, inputs: [], outputs: [] };
    try {
      const acc = await navigator.requestMIDIAccess({ sysex: false });
      return {
        supported: true,
        inputs: [...acc.inputs.values()].map(i => i.name),
        outputs: [...acc.outputs.values()].map(o => o.name),
      };
    } catch (e) {
      return { supported: true, error: e.message, inputs: [], outputs: [] };
    }
  });
}

test('con teclado conectado: la app lo detecta y auto-configura la salida', async ({ page }) => {
  await bootApp(page);
  const dev = await midiDevices(page);
  test.skip(!dev.supported || dev.inputs.length === 0,
    'sin teclado MIDI conectado — conecta el Yamaha y vuelve a correr');
  // el pill de estado muestra el nombre del dispositivo, no "Sin MIDI"
  await expect(page.locator('#status-text')).not.toHaveText(/Sin MIDI|Buscando/);
  if (dev.outputs.length) {
    // sin preferencia guardada + hay salida → modo Yamaha automático
    const mode = await page.evaluate(() => outputMode);
    expect(mode).toBe('yamaha');
  }
});

test('con salida MIDI: notas y cambio de voz viajan sin lanzar errores', async ({ page }) => {
  await bootApp(page);
  const dev = await midiDevices(page);
  test.skip(dev.outputs.length === 0, 'sin salida MIDI — test omitido');
  const errores = await page.evaluate(async () => {
    const errs = [];
    try {
      noteOn(60, 90, 'virtual');               // debe sonar en el Yamaha
      await new Promise(r => setTimeout(r, 200));
      noteOff(60);
    } catch (e) { errs.push('nota: ' + e.message); }
    try { sendYamahaProgramChange(0, 112, 0); } // Grand Piano, Bank XGlite
    catch (e) { errs.push('program change: ' + e.message); }
    return errs;
  });
  expect(errores).toEqual([]);
});

test('INTERACTIVO: pulsa una tecla del Yamaha y la app la refleja', async ({ page }) => {
  test.skip(!process.env.YAMAHA_LIVE,
    'solo con YAMAHA_LIVE=1 (requiere un humano tocando el teclado)');
  await bootApp(page);
  const dev = await midiDevices(page);
  test.skip(dev.inputs.length === 0, 'sin teclado MIDI conectado');
  await page.evaluate(() => {
    window.__gotNote = null;
    const _no = noteOn;
    noteOn = (m, v, s) => { if (s === 'midi-in') window.__gotNote = m; return _no(m, v, s); };
  });
  console.log('\n  >>> 🎹 TOCA UNA TECLA EN EL YAMAHA (tienes 10 segundos)...\n');
  await page.waitForFunction(() => window.__gotNote !== null, null, { timeout: 10000 });
  const midi = await page.evaluate(() => window.__gotNote);
  expect(midi).toBeGreaterThanOrEqual(21);
  expect(midi).toBeLessThanOrEqual(108);
  await expect(page.locator('#note-name-display')).toHaveClass(/show/);
  console.log('  >>> ✓ nota recibida: midi ' + midi + '\n');
});
