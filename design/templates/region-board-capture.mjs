// Opens the main Region board (zoomed out, start of a turn), measures every layout
// box, and draws a blank wireframe of them over the screen. No buttons, pop-ups or
// slide-in cards. Usage: node wireframe-board.mjs <outFile>
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
await page.waitForSelector('.title-screen', { timeout: 60000 });
await page.evaluate(async () => { window.__eng = { ...(await import('/src/engine/setup.ts')), ...(await import('/src/engine/match.ts')) }; });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
await page.click('.title-screen'); await w(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Exhibition')).click());
await w(5200);
await page.evaluate(async () => {
  const E = window.__eng;
  const act = (s, x) => { const r = E.applyAction(s, x); if (!r.ok) throw new Error(r.reason); return r.state; };
  let s = E.createMatch();
  s = act(s, { type: 'setLordOrder', player: 'p1', order: ['raiders', 'army', 'garrison'] });
  s = act(s, { type: 'setLordOrder', player: 'p2', order: ['raiders', 'garrison', 'army'] });
  window.__matchStore.setState({ match: s, announcement: null, reports: [], focusedRegion: null, selectedCaptainId: null });
});
await w(1500);
await page.evaluate(() => document.fonts.ready);

await page.evaluate(() => {
  const kinds = [
    // [selector, style]: zone, bar, slot, card, line, tile, dashed, pill, track, art
    ['.match__top-bar', 'bar'],
    ['.player-panel', 'zone'],
    ['.board-stage', 'zone'],
    ['.phase-window', 'bar'],
    ['.top-bar__title', 'line'],
    ['.top-bar__turn', 'line'],
    ['.player-panel__name', 'line'],
    ['.player-panel__status', 'line'],
    ['.lord-row', 'slot'],
    ['.lord-row .lord-card, .lord-row .card', 'card'],
    ['.lord-row__title', 'line'],
    ['.lord-row__class', 'line'],
    ['.lord-bar__label', 'line'],
    ['.lord-bar__track', 'track'],
    ['.captain-icon', 'slot'],
    ['.captain-icon .portrait', 'card'],
    ['.captain-icon__name', 'line'],
    ['.turn-phases', 'bar'],
    ['.turn-phases__step', 'pill'],
    ['.turn-phases__text', 'line'],
    ['.region', 'tile'],
    ['.region__name', 'line'],
    ['.region__map-square', 'dashed'],
    ['.region__captain-empty', 'dashed'],
    ['.hud-avatar', 'art'],
    ['.resource-bar__name', 'line'],
    ['.resource-bars__label', 'line'],
    ['.resource-bar__track', 'track'],
  ];
  const seen = new Set();
  const boxes = [];
  for (const [sel, kind] of kinds) {
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      // Text lines: only as wide as the text, as a bar.
      if (kind === 'line') {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        if (t.width < 2) continue;
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
    dashed: 'background:#2e261d;border:2px dashed #4a3d2f;border-radius:6px;',
    pill: 'background:#2a231b;border:2px solid #4a3d2f;border-radius:5px;',
    track: 'background:#2a231b;border:2px solid #5a4a38;border-radius:3px;',
    art: 'background:rgba(90,74,56,0.18);border:2px dashed #5a4a38;border-radius:12px;',
  };
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#15110d;';
  // Areas first, then the avatars, then everything on top (the bars draw over the avatars as in the game).
  const layer = (k) => (k === 'zone' || k === 'bar' ? 0 : k === 'art' ? 1 : 2);
  boxes.sort((a, b) => layer(a.kind) - layer(b.kind));
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
