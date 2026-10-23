// Opens the zoomed-in Region view with both players' Captains present, measures
// every layout box, and draws a blank wireframe of them over the screen.
// Usage: node wireframe-live.mjs <outFile>
import puppeteer from 'puppeteer-core';

const outFile = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  userDataDir: 'C:/Users/blark/AppData/Local/Temp/claude/cw-capture/profile',
  args: ['--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(`
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__click = async (sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text));
    el.click();
    await window.__wait(100);
  };
  window.__region = (name) => [...document.querySelectorAll('.region')].find((r) => r.querySelector('.region__name').textContent === name);`);

// Player 1 stations a Captain in the Heartland; Player 2 contests it and zooms in.
await page.evaluate(async () => {
  document.querySelector('.title-screen').click();
  await __wait(100);
  await __click('button', 'Exhibition vs computer');
  for (const l of ['Raiders', 'Army', 'Garrison']) await __click('.lord-setup__choice', 'Lord of the ' + l);
  await __click('button', 'Confirm order');
  for (const l of ['Garrison', 'Raiders', 'Army']) await __click('.lord-setup__choice', 'Lord of the ' + l);
  await __click('button', 'Confirm order');
  document.querySelector('.turn-announcement')?.click();
  await __wait(100);
  __region('Heartland').click(); await __wait(100);
  __region('Heartland').click(); await __wait(800);
  document.querySelectorAll('.inner-board__square')[4].click(); await __wait(150);
  await __click('button', 'End turn'); await __wait(2800);
  document.querySelector('.turn-announcement')?.click(); await __wait(100);
  __region('Heartland').click(); await __wait(100);
  __region('Heartland').click(); await __wait(900);
});

// Measure layout boxes, then cover the screen with a blank drawing of them.
await page.evaluate(() => {
  const kinds = [
    // [selector, style] — styles: zone, bar, slot, card, line, btn, pill, dashed
    ['.match__top-bar', 'bar'],
    ['.player-panel', 'zone'],
    ['.board-stage', 'zone'],
    ['.phase-window', 'bar'],
    ['.match__top-bar .top-bar__button', 'btn'],
    ['.top-bar__title', 'line'],
    ['.top-bar__turn', 'line'],
    ['.player-panel__name', 'line'],
    ['.player-panel__militia', 'line'],
    ['.player-panel__status', 'line'],
    ['.company__where', 'line'],
    ['.company__captain', 'slot'],
    ['.company__captain .card', 'card'],
    ['.company__captain-name', 'line'],
    ['.company__captain-lord', 'line'],
    ['.company__stats', 'line'],
    ['.knight-token', 'slot'],
    ['.knight-token__shield', 'card'],
    ['.knight-token__name', 'line'],
    ['.knight-token__detail', 'line'],
    ['.region-view__title', 'line'],
    ['.inner-board', 'tile'],
    ['.inner-board__square', 'dashed'],
    ['.phase-list__item', 'pill'],
    ['.phase-window__instruction', 'line'],
    ['.phase-window__end-turn', 'btn'],
  ];
  const boxes = [];
  for (const [sel, kind] of kinds) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // Text lines: draw only as wide as the text, as a bar.
      if (kind === 'line') {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        boxes.push({ kind, x: t.left, y: t.top + t.height * 0.2, w: Math.min(t.width, r.width), h: t.height * 0.6 });
      } else {
        boxes.push({ kind, x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
  }
  const styles = {
    zone: 'background:#241d16;border:2px solid #3a3026;',
    bar: 'background:#1c1712;border:2px solid #3a3026;',
    slot: 'background:#2e261d;border:2px solid #4a3d2f;border-radius:8px;',
    card: 'background:#3a3026;border:2px solid #5a4a38;border-radius:8px;',
    line: 'background:#3a3026;border-radius:4px;',
    tile: 'background:#26261a;border:2px solid #46412c;border-radius:10px;',
    dashed: 'background:#2e261d;border:2px dashed #4a3d2f;border-radius:8px;',
    btn: 'background:#2e261d;border:2px solid #6b5636;border-radius:6px;',
    pill: 'background:#2a231b;border:2px solid #4a3d2f;border-radius:6px;',
  };
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#15110d;';
  for (const b of boxes) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;box-sizing:border-box;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;${styles[b.kind]}`;
    overlay.appendChild(d);
  }
  // Player accent strips on the panels.
  for (const [x, c] of [[0, '#2f4a6e'], [1520, '#6e2f2a']]) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${x}px;top:64px;width:400px;height:6px;background:${c};`;
    overlay.appendChild(d);
  }
  document.body.appendChild(overlay);
});
await page.screenshot({ path: outFile });
await browser.close();
console.log('saved');
