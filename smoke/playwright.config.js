/**
 * Config de las pruebas de humo en navegador real (Nivel 2).
 * Requiere internet: Tone.js/OSMD/samples vienen de CDN.
 * Correr con: npm run smoke
 */
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',
  timeout: 120000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8123',
    headless: true,
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: 'node ' + __dirname + '/server.js',
    port: 8123,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
