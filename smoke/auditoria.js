/**
 * Auditoría de precisión y calidad — ejecuta las métricas del README contra
 * la app real en Chromium. No modifica piano_pro.html: instrumenta envolviendo
 * funciones globales vía page.evaluate.
 *
 *   node smoke/auditoria.js
 *
 * Métricas cubiertas (numeración del README):
 *   #1 latencia reportada por el contexto de audio (estimación del navegador)
 *   #2 jitter del autoplay vs tiempo teórico — BAJO CARGA (acordes + falling + metrónomo)
 *   #3 margen de programación del metrónomo (¿algún click llegó tarde?)
 *   #4 overhead de captura de la grabadora
 *   #5 estabilidad de frames del rAF bajo carga
 *   #6 ráfaga de 200 eventos MIDI → notas perdidas/colgadas
 *   #7 ficha de los samples del CDN (formato y peso reales)
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('@playwright/test');

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))];
};
const ms = v => v == null ? 'n/a' : (v * 1000).toFixed(2) + 'ms';
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

(async () => {
  const server = spawn('node', [path.join(__dirname, 'server.js')], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text()); });

  console.log('· booting app (descarga de samples del CDN)…');
  await page.goto('http://localhost:8123/piano_pro.html');
  await page.waitForSelector('#splash button', { state: 'visible', timeout: 90000 });
  await page.click('#splash button');
  await page.waitForFunction(() => samplerReady === true, null, { timeout: 90000 });

  // ---- #1 Latencia reportada por el contexto de audio ----
  const audio = await page.evaluate(() => {
    const c = Tone.context.rawContext;
    return {
      sampleRate: c.sampleRate,
      baseLatency: c.baseLatency ?? null,
      outputLatency: c.outputLatency ?? null,
      state: c.state,
    };
  });

  // ---- #6 Ráfaga MIDI: 200 eventos por el mismo camino que Web MIDI ----
  const burst = await page.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) noteOn(21 + (i % 88), 100, 'midi-in');
    const procesadoEn = performance.now() - t0;
    const activasTrasOn = Object.keys(activeKeys).filter(k => activeKeys[k]).length;
    for (let i = 0; i < 200; i++) noteOff(21 + (i % 88), 'midi-in');
    await new Promise(r => setTimeout(r, 150));
    return {
      procesadoEnMs: +procesadoEn.toFixed(1),
      activasTrasOn,
      colgadas: Object.keys(activeKeys).filter(k => activeKeys[k]).length,
      liveNotesResiduo: liveNotes.size,
    };
  });

  // ---- #4 Overhead de captura de la grabadora ----
  const rec = await page.evaluate(async () => {
    toggleRecording();
    const reales = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 15));
      reales.push(performance.now());
      noteOn(60 + (i % 12), 90);
      await new Promise(r => setTimeout(r, 8));
      noteOff(60 + (i % 12));
    }
    stopRecording();
    const t = recState.take;
    if (!t) return { error: 'sin toma' };
    const base = reales[0];
    const deltas = t.notes.map((n, i) => Math.abs(n.time - (reales[i] - base) / 1000) * 1000);
    return { notas: t.notes.length, maxDeltaMs: +Math.max(...deltas).toFixed(4) };
  });

  // ---- #2/#3/#5 Estrés: autoplay con acordes + falling + metrónomo 180bpm ----
  console.log('· fase de estrés (30s): 525 notas con acordes + falling + metrónomo 180bpm…');
  await page.evaluate(() => {
    const notes = [];
    for (let i = 0; i < 300; i++) {
      const t = i * 0.1;
      notes.push({ midi: 36 + (i % 48), time: t, duration: 0.09, velocity: 0.7, hand: 'right' });
      if (i % 4 === 0) { // acorde de 4 notas cada 400ms → picos de polifonía
        for (let k = 1; k <= 3; k++) notes.push({ midi: 48 + ((i + k * 7) % 36), time: t, duration: 0.35, velocity: 0.6, hand: 'left' });
      }
    }
    loadSong(notes, 'AUDITORIA', 120);
    songState.waitMode = false;
    window.__jit = [];
    // Camino nuevo (auditoría #1): el autoplay PROGRAMA en el reloj de audio.
    // Jitter = |tiempo programado − tiempo teórico| anclado a Tone.now() del play.
    const expByName = {};
    songState.notes.slice().sort((a, b) => a.time - b.time)
      .forEach(n => { const nm = midiToToneName(n.midi); (expByName[nm] = expByName[nm] || []).push(n.time); });
    const _tar = sampler.triggerAttackRelease.bind(sampler);
    sampler.triggerAttackRelease = (name, dur, time, vel) => {
      const q = expByName[name];
      if (q && q.length && window.__t0 != null) {
        window.__jit.push(Math.abs((time ?? Tone.now()) - (window.__t0 + q.shift())));
      }
      return _tar(name, dur, time, vel);
    };
    // Camino viejo (fallback por si el autoplay dispara inmediato vía audioNoteOn)
    window.__exp = {};
    songState.notes.slice().sort((a, b) => a.time - b.time)
      .forEach(n => { (window.__exp[n.midi] = window.__exp[n.midi] || []).push(n.time); });
    const _a = audioNoteOn;
    audioNoteOn = (m, v) => {
      const q = window.__exp[m];
      if (q && q.length) window.__jit.push(Math.abs(getSongTime() - q.shift()));
      return _a(m, v);
    };
    // frames del rAF
    window.__frames = [];
    const _rf = renderFallingFrame;
    renderFallingFrame = () => { window.__frames.push(performance.now()); return _rf(); };
    // margen del scheduler del metrónomo
    window.__metro = [];
    const _s = scheduleMetroClick;
    scheduleMetroClick = (time) => { window.__metro.push(time - Tone.now()); return _s(time); };
    setBPM(180);
    document.getElementById('chk-metro').checked = true;
    toggleMetronomo(true);
    togglePlay();
    window.__t0 = Tone.now(); // ancla: instante de audio en que arrancó la canción (pausedAt=0)
  });
  await page.waitForFunction(() => songState.playing === false, null, { timeout: 60000 });
  await page.evaluate(() => toggleMetronomo(false));
  // margen para que los note-off pendientes de las últimas notas terminen su
  // duración natural (si no, se leerían como "colgadas" sin serlo)
  await page.waitForTimeout(800);

  const stress = await page.evaluate(() => {
    const gaps = [];
    for (let i = 1; i < window.__frames.length; i++) gaps.push(window.__frames[i] - window.__frames[i - 1]);
    return {
      jit: window.__jit,
      disparos: window.__jit.length,
      frameGaps: gaps,
      metroMargins: window.__metro,
      colgadasTrasEstres: Object.keys(activeKeys).filter(k => activeKeys[k]).length,
    };
  });

  await browser.close();
  server.kill();

  // ---- #7 Ficha de los samples del CDN ----
  console.log('· ficha de samples (HEAD al CDN)…');
  const notas = ['A0','C1','D#1','F#1','A1','C2','D#2','F#2','A2','C3','D#3','F#3','A3','C4','D#4','F#4','A4','C5','D#5','F#5','A5','C6','D#6','F#6','A6','C7','D#7','F#7','A7','C8'];
  let totalBytes = 0, tipo = '?';
  for (const n of notas) {
    try {
      const r = await fetch('https://tonejs.github.io/audio/salamander/' + n.replace('#','s') + '.mp3', { method: 'HEAD' });
      totalBytes += +(r.headers.get('content-length') || 0);
      tipo = r.headers.get('content-type') || tipo;
    } catch (e) { /* red */ }
  }

  // ---- INFORME ----
  const jitS = stress.jit; // segundos
  const gapsMs = stress.frameGaps;
  const informe = {
    'errores de consola durante toda la auditoría': consoleErrors.length ? consoleErrors : 'ninguno',
    '#1 contexto de audio': {
      sampleRate: audio.sampleRate + ' Hz',
      baseLatency: audio.baseLatency != null ? ms(audio.baseLatency) : 'no reportada',
      outputLatency: audio.outputLatency != null ? ms(audio.outputLatency) : 'no reportada',
      nota: 'medido en headless; en escritorio real la outputLatency será mayor',
    },
    '#2 jitter del autoplay (bajo carga, 525 notas)': {
      disparos: stress.disparos,
      media: ms(mean(jitS)),
      p95: ms(pct(jitS, 95)),
      max: ms(Math.max(...jitS)),
      objetivoEdu: '≤ 25ms', objetivoPro: '≤ 3ms',
    },
    '#3 metrónomo (180bpm durante el estrés)': {
      clicks: stress.metroMargins.length,
      margenMinimo: ms(Math.min(...stress.metroMargins)),
      clicksTarde: stress.metroMargins.filter(m => m < 0).length,
      nota: 'margen = con cuánta antelación se programó cada click en el reloj de audio; <0 = llegó tarde',
    },
    '#4 grabadora': {
      notasCapturadas: rec.notas,
      overheadMaximo: rec.maxDeltaMs + 'ms',
      nota: 'diferencia entre el instante real del noteOn y el timestamp grabado',
    },
    '#5 frames bajo carga': {
      frames: gapsMs.length,
      fpsMedio: (1000 / mean(gapsMs)).toFixed(1),
      gapP95: pct(gapsMs, 95).toFixed(1) + 'ms',
      gapMax: Math.max(...gapsMs).toFixed(1) + 'ms',
      framesPerdidos: gapsMs.filter(g => g > 25).length + ' (gaps >25ms)',
    },
    '#6 ráfaga MIDI (200 eventos)': {
      procesadoEn: burst.procesadoEnMs + 'ms',
      activasTrasOn: burst.activasTrasOn + '/88 teclas únicas',
      notasColgadas: burst.colgadas,
      residuoSampler: burst.liveNotesResiduo,
    },
    '#7 samples Salamander (CDN)': {
      archivos: notas.length,
      formato: tipo,
      pesoTotal: (totalBytes / 1024 / 1024).toFixed(1) + ' MB',
      capasVelocity: 1,
      nota: 'el Salamander original es WAV 48kHz/16 capas; esta es la reducción mp3 de Tone.js',
    },
    'estado tras estrés': { notasColgadas: stress.colgadasTrasEstres },
  };
  console.log('\n════════ INFORME DE AUDITORÍA ════════\n');
  console.log(JSON.stringify(informe, null, 2));
})().catch(e => { console.error('AUDITORÍA FALLÓ:', e); process.exit(1); });
