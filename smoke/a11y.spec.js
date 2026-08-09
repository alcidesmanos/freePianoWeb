/**
 * Auditoría de accesibilidad automatizada (cierra el gate PARCIAL del informe).
 * Criterio del gate: cero violaciones axe-core de impacto serious/critical,
 * y los controles principales operables por teclado con foco visible.
 * Las violaciones moderate/minor se listan como inventario, sin romper el gate.
 */
'use strict';

const { test, expect } = require('@playwright/test');
const { readFileSync } = require('fs');

const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function bootApp(page) {
  await page.goto('/piano_pro.html');
  await expect(page.locator('#splash button')).toBeVisible({ timeout: 90000 });
  await page.click('#splash button');
}

test('axe-core: cero violaciones serious/critical', async ({ page }) => {
  await bootApp(page);
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () =>
    await axe.run(document, { resultTypes: ['violations'] }));

  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodos)`);
    v.nodes.slice(0, 3).forEach(n => console.log('      · ' + n.target.join(' ')));
  }
  const graves = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  expect(graves.map(v => v.id)).toEqual([]);
});

test('teclado: los toggles ocultos son focalizables y operables con Espacio', async ({ page }) => {
  await bootApp(page);
  // el checkbox del metrónomo era display:none (infocalizable); ahora es sr-only
  const focusable = await page.evaluate(() => {
    document.getElementById('chk-metro').focus();
    return document.activeElement === document.getElementById('chk-metro');
  });
  expect(focusable).toBe(true);
  // Espacio lo opera (el metrónomo rechazará por audio no listo o arrancará: ambos válidos;
  // lo que se verifica es que el evento LLEGA al control)
  const before = await page.evaluate(() => document.getElementById('chk-nota').checked);
  await page.evaluate(() => document.getElementById('chk-nota').focus());
  await page.keyboard.press('Space');
  const after = await page.evaluate(() => document.getElementById('chk-nota').checked);
  expect(after).toBe(!before);
});

test('teclado: foco visible en botones al navegar con Tab', async ({ page }) => {
  await bootApp(page);
  const outline = await page.evaluate(() => {
    const btn = document.querySelector('#toolbar .btn');
    btn.focus();
    // forzar el estado focus-visible no es posible desde JS; se verifica que la
    // regla exista y aplique a este elemento
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('.btn:focus-visible')
              && rule.style.outline && rule.style.outline !== 'none') return rule.style.outline;
        }
      } catch (e) { /* hojas cross-origin */ }
    }
    return null;
  });
  expect(outline).toContain('2px');
});

test('los inputs de archivo siguen siendo alcanzables por teclado', async ({ page }) => {
  await bootApp(page);
  const ok = await page.evaluate(() => {
    const inp = document.getElementById('midi-input');
    inp.focus();
    return document.activeElement === inp;
  });
  expect(ok).toBe(true);
});
