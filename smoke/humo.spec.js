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
  await page.goto('/index.html');
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

test('cargar MusicXML crea la lección; Esperar viene APAGADO y al activarlo propone teclas', async ({ page }) => {
  const errors = trackErrors(page);
  await bootApp(page);
  await page.setInputFiles('#file-input', 'library/11-personal/Atardecer_balada_pop_original.musicxml');
  await expect(page.locator('#lesson-panel')).toHaveClass(/show/, { timeout: 30000 });
  await expect(page.locator('#lesson-notes')).not.toHaveText('0 notas');
  await expect(page.locator('#lesson-empty')).toBeHidden();

  const estado = await page.evaluate(() => ({
    loaded: songState.loaded,
    notas: songState.allNotes.length,
    conDedo: songState.allNotes.filter(n => n.finger).length,
    esperar: songState.waitMode,
    teclasResaltadas: Object.keys(highlightedKeys).length,
    hasScore: songState.hasScore,
  }));
  expect(estado.loaded).toBe(true);
  expect(estado.notas).toBe(37);
  expect(estado.conDedo).toBe(37); // las digitaciones del XML llegaron a las notas
  // Decisión UX 2026-08-10: Esperar APAGADO por defecto — un usuario nuevo da
  // Play y espera OÍR la pieza, no que la app se quede muda pidiendo teclas.
  expect(estado.esperar).toBe(false);
  expect(estado.teclasResaltadas).toBe(0); // sin Esperar no se propone nada
  expect(estado.hasScore).toBe(true); // el score-following quedó activo
  // El camino del que SÍ practica: activar el toggle propone las teclas
  await page.locator('label.toggle:has(#chk-wait)').click();
  await page.waitForTimeout(150);
  const conEsperar = await page.evaluate(() => ({
    esperar: songState.waitMode,
    teclasResaltadas: Object.keys(highlightedKeys).length,
  }));
  expect(conEsperar.esperar).toBe(true);
  expect(conEsperar.teclasResaltadas).toBeGreaterThan(0); // wait mode propone teclas
  expect(errors).toEqual([]);
});

test('recargar la página restaura la sesión desde IndexedDB', async ({ page }) => {
  await bootApp(page);
  await page.setInputFiles('#file-input', 'library/11-personal/Atardecer_balada_pop_original.musicxml');
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

test('Für Elise de un click: pieza embebida carga sin red externa', async ({ page }) => {
  await bootApp(page);
  // bloquear TODO lo externo salvo el localhost: la pieza va embebida en el HTML
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await page.click('#toolbar [data-furelise]');
  await expect(page.locator('#lesson-panel')).toHaveClass(/show/, { timeout: 30000 });
  const estado = await page.evaluate(() => ({
    nombre: songState.name,
    notas: songState.allNotes.length,
    conDedo: songState.allNotes.filter(n => n.finger).length,
  }));
  expect(estado.nombre).toContain('Für Elise');
  expect(estado.notas).toBeGreaterThanOrEqual(50);
  expect(estado.conDedo).toBeGreaterThanOrEqual(50); // el arreglo propio viene 100% digitado
});

test('flag "Notas en teclas" guardado: al recargar, las letras se PINTAN (píxeles, no solo el checkbox)', async ({ page }) => {
  await bootApp(page);
  const ink = () => page.evaluate(() => {
    const c = document.getElementById('piano-canvas');
    const ctx = c.getContext('2d');
    const y0 = Math.floor(c.height * 0.70), h = Math.floor(c.height * 0.27);
    const d = ctx.getImageData(0, y0, c.width, h).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i] < 120 && d[i + 3] > 200) dark++; }
    return dark;
  });
  const sinLetras = await ink();
  await page.evaluate(() => setPracticeMode(true));
  await page.waitForTimeout(150); // el repintado es 1× por frame
  const conLetras = await ink();
  expect(conLetras).toBeGreaterThan(sinLetras + 500);

  await page.reload();
  await expect(page.locator('#splash button')).toBeVisible({ timeout: 90000 });
  await page.click('#splash button');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => practiceMode)).toBe(true);
  await expect(page.locator('#chk-practice')).toBeChecked();
  const trasRecarga = await ink();
  expect(trasRecarga).toBeGreaterThan(sinLetras + 500); // las letras EXISTEN en el canvas
});

test('R1-R4: el piano queda SOBRE el pliegue en un laptop (1366×768) y el score se enfoca solo', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await bootApp(page);
  await page.click('#toolbar [data-furelise]');
  await page.waitForFunction(() => songState.loaded, null, { timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('.toast .close').forEach(c => c.click()));
  await page.waitForTimeout(300);
  const estado = await page.evaluate(() => ({
    pianoSobrePliegue: document.getElementById('piano-canvas').getBoundingClientRect().bottom <= innerHeight,
    cascadaVisible: document.getElementById('falling-canvas').getBoundingClientRect().top >= 0,
    scoreColapsado: document.getElementById('score-section').classList.contains('hidden'),
    toolbarVisibles: [...document.querySelectorAll('#toolbar button,#toolbar select,#toolbar input:not([type=checkbox]),#toolbar label.toggle,#toolbar a.btn')].filter(e => e.offsetParent !== null).length,
    modoSencillo: document.body.classList.contains('ui-simple'),
  }));
  expect(estado.pianoSobrePliegue).toBe(true);   // la razón de ser de R1
  expect(estado.cascadaVisible).toBe(true);
  expect(estado.scoreColapsado).toBe(true);
  expect(estado.modoSencillo).toBe(true);        // el default es Sencillo
  expect(estado.toolbarVisibles).toBeLessThanOrEqual(10); // divulgación progresiva
  // R4: al reproducir, la partitura desaparece; al pausar, vuelve
  await page.evaluate(() => { toggleScore(); togglePlay(); }); // ábrela y dale play
  await page.waitForTimeout(150);
  expect(await page.evaluate(() =>
    getComputedStyle(document.getElementById('score-section')).display)).toBe('none');
  await page.evaluate(() => togglePlay());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() =>
    getComputedStyle(document.getElementById('score-section')).display)).not.toBe('none');
});

test('teoría en vivo: acorde, tonalidad y número romano aparecen', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => setUiMode('full')); // las herramientas viven tras "Más ▾"
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
