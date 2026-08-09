/**
 * Pruebas de humo Nivel 2: la app real en Chromium headless.
 * Cubren el camino crítico de punta a punta: boot sin errores, audio listo,
 * tocar una tecla, cargar una partitura con digitaciones y restaurar sesión.
 * Web MIDI (el cable al Yamaha) es lo único que no se puede simular aquí.
 */
'use strict';

const { test, expect } = require('@playwright/test');

// Errores de consola que no son fallo de la app
const IGNORABLE = [/favicon/i];

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && !IGNORABLE.some(rx => rx.test(msg.text()))) {
      errors.push('console.error: ' + msg.text());
    }
  });
  return errors;
}

async function bootApp(page) {
  await page.goto('/piano_pro.html');
  // El splash llega a "ready" cuando los samples Salamander terminaron de bajar del CDN
  await expect(page.locator('#splash button')).toBeVisible({ timeout: 90000 });
  await page.click('#splash button'); // gesto de usuario → desbloquea AudioContext
  await expect(page.locator('#splash')).toHaveClass(/gone/);
}

test('boot completo sin errores de consola y audio listo', async ({ page }) => {
  const errors = trackErrors(page);
  await bootApp(page);
  await expect(page.locator('#audio-text')).toHaveText(/listo/i);
  expect(errors).toEqual([]);
});

test('click en el teclado virtual muestra la nota en el hero', async ({ page }) => {
  await bootApp(page);
  const canvas = page.locator('#piano-canvas');
  await canvas.scrollIntoViewIfNeeded(); // el piano puede quedar bajo el pliegue
  const box = await canvas.boundingBox();
  // Zona baja del canvas = cuerpo de tecla blanca (las negras terminan al 62%)
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.85);
  await expect(page.locator('#note-name-display')).toHaveClass(/show/);
  const texto = await page.locator('#note-name-display').textContent();
  expect(texto.length).toBeGreaterThan(0);
});

test('cargar MusicXML crea la lección con digitaciones y highlight de espera', async ({ page }) => {
  const errors = trackErrors(page);
  await bootApp(page);
  await page.setInputFiles('#xml-input', 'library/11-personal/Atardecer_balada_pop_original.musicxml');
  await expect(page.locator('#lesson-panel')).toHaveClass(/show/, { timeout: 30000 });
  await expect(page.locator('#lesson-notes')).not.toHaveText('0 notas');
  await expect(page.locator('#lesson-empty')).toBeHidden();

  const estado = await page.evaluate(() => ({
    loaded: songState.loaded,
    notas: songState.allNotes.length,
    conDedo: songState.allNotes.filter(n => n.finger).length,
    teclasResaltadas: Object.keys(highlightedKeys).length,
    hasScore: songState.hasScore,
  }));
  expect(estado.loaded).toBe(true);
  expect(estado.notas).toBe(37);
  expect(estado.conDedo).toBe(37); // las digitaciones del XML llegaron a las notas
  expect(estado.teclasResaltadas).toBeGreaterThan(0); // wait mode propone teclas
  expect(estado.hasScore).toBe(true); // el score-following quedó activo
  expect(errors).toEqual([]);
});

test('recargar la página restaura la sesión desde IndexedDB', async ({ page }) => {
  await bootApp(page);
  await page.setInputFiles('#xml-input', 'library/11-personal/Atardecer_balada_pop_original.musicxml');
  await expect(page.locator('#lesson-panel')).toHaveClass(/show/, { timeout: 30000 });
  await page.waitForTimeout(800); // margen para el idbSet asíncrono

  await page.reload();
  await page.waitForFunction(() => typeof songState !== 'undefined' && songState.loaded === true,
    null, { timeout: 30000 });
  const restaurada = await page.evaluate(() => ({
    nombre: songState.name,
    notas: songState.allNotes.length,
    hasScore: songState.hasScore,
  }));
  expect(restaurada.nombre).toContain('Atardecer');
  expect(restaurada.notas).toBe(37);
  expect(restaurada.hasScore).toBe(false); // restaurada = sin partitura renderizada
});

test('teoría en vivo: acorde, tonalidad y número romano aparecen', async ({ page }) => {
  await bootApp(page);
  // Fijar C mayor desde el círculo (construcción perezosa incluida)
  await page.click('#btn-circle');
  await expect(page.locator('#circle-section')).not.toHaveClass(/hidden/);
  await page.evaluate(() => onCircleClick(0, false));
  await expect(page.locator('#chk-scale')).toBeChecked();
  // Tocar C mayor por API de notas (el camino real del MIDI-in)
  await page.evaluate(() => { noteOn(60, 80); noteOn(64, 80); noteOn(67, 80); });
  await expect(page.locator('#chord-display')).toHaveText('C');
  await expect(page.locator('#roman-display')).toHaveText('I');
  await page.evaluate(() => { noteOff(60); noteOff(64); noteOff(67); });
});
