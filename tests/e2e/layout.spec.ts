import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';

const shotDir = 'tests/e2e/screens';
fs.mkdirSync(shotDir, { recursive: true });

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // il suggerimento "Aggiungi a Home" è una tantum: lo diamo per già visto
  await page.addInitScript(() => localStorage.setItem('sd.installhint', '1'));
  await page.goto('/');
  await expect(page.locator('#homeStart')).toBeVisible();
}

test('layout: niente scroll, canvas in proporzione e dentro lo schermo, nessun controller', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shotDir}/${info.project.name}-home.png` });
  const hb = await page.locator('#homeStart').boundingBox();
  const cb = await page.locator('#screen').boundingBox();
  expect(hb!.y).toBeGreaterThan(cb!.y);
  expect(hb!.y + hb!.height).toBeLessThanOrEqual(cb!.y + cb!.height);
  expect(hb!.height).toBeGreaterThan(24);
  await page.locator('#homeStart').click();
  await page.waitForFunction(() => !document.getElementById('app')!.classList.contains('home'));
  const m = await page.evaluate(() => {
    const c = document.getElementById('screen')!.getBoundingClientRect();
    const r = (id: string) => { const b = document.getElementById(id)!.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, vis: getComputedStyle(document.getElementById(id)!).display !== 'none' }; };
    return {
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
      sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
      c: { x: c.left, y: c.top, w: c.width, h: c.height },
      controllers: document.querySelectorAll('#fire, #pad, #btnL, #btnR, .zone').length,
      touch: document.getElementById('app')!.classList.contains('touch'),
    };
  });
  expect(m.sw).toBeLessThanOrEqual(m.vw);
  expect(m.sh).toBeLessThanOrEqual(m.vh);
  expect(Math.abs(m.c.w / m.c.h - 224 / 288)).toBeLessThan(0.01);
  expect(m.c.x).toBeGreaterThanOrEqual(0);
  expect(m.c.x + m.c.w).toBeLessThanOrEqual(m.vw + 0.5);
  expect(m.c.y + m.c.h).toBeLessThanOrEqual(m.vh + 0.5);
  // centrato orizzontalmente
  expect(Math.abs(m.c.x + m.c.w / 2 - m.vw / 2)).toBeLessThan(2);
  // niente controller a schermo: si gioca col dito su tutta la superficie
  expect(m.controllers).toBe(0);
  await page.screenshot({ path: `${shotDir}/${info.project.name}-controls.png` });
  expect(errors).toEqual([]);
});

test('gioco: parte, si muove, spara e mantiene il frame time', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  // la home resta ferma finché non si preme START
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__sd.game.mode)).toBe('title');
  await page.locator('#homeStart').click();
  expect(await page.evaluate(() => (window as any).__sd.game.mode)).toBe('game');
  await page.waitForFunction(() => (window as any).__sd.game.playerPhase === 'alive', null, { timeout: 30000 });
  if (await page.evaluate(() => document.getElementById('app')!.classList.contains('touch'))) {
    // dito appoggiato sotto la nave e trascinato in alto a sinistra: la nave lo segue e spara da sola
    const before = await page.evaluate(() => { const g = (window as any).__sd.game; return { x: g.px, y: g.py }; });
    const c = (await page.locator('#screen').boundingBox())!;
    const k = c.width / 224;
    const sx = c.x + before.x * k, sy = c.y + (before.y + 10) * k;
    const ev = (type: string, x: number, y: number) => page.locator('#app').dispatchEvent(type, {
      pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true,
    });
    await ev('pointerdown', sx, sy);
    for (let i = 1; i <= 10; i++) { await ev('pointermove', sx - i * 3 * k, sy - i * 4 * k); await page.waitForTimeout(20); }
    await page.waitForFunction(() => (window as any).__sd.game.shots > 0, null, { timeout: 10000 });
    const after = await page.evaluate(() => { const g = (window as any).__sd.game; return { x: g.px, y: g.py }; });
    if (await page.evaluate(() => (window as any).__sd.game.playerPhase === 'alive')) {
      expect(after.x).toBeCloseTo(before.x - 30, 0);
      expect(after.y).toBeCloseTo(before.y - 40, 0);
    }
    await ev('pointerup', sx - 30 * k, sy - 40 * k);
    // dito alzato: il fuoco si ferma
    const s1 = await page.evaluate(() => (window as any).__sd.game.shots);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).__sd.game.shots)).toBe(s1);
  } else {
    await page.keyboard.down('Space');
    await page.waitForFunction(() => (window as any).__sd.game.shots > 0, null, { timeout: 10000 });
    await page.keyboard.up('Space');
  }
  const shots = await page.evaluate(() => (window as any).__sd.game.shots);
  expect(shots).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${shotDir}/${info.project.name}-play.png` });
  // Benchmark deterministico: 600 tick + render di fila (logica e disegno reali, partita in corso).
  const perFrame = await page.evaluate(() => (window as any).__sd.bench(600));
  console.log(`[${info.project.name}] costo medio per frame ${perFrame.toFixed(2)} ms (budget 16,7 ms)`);
  expect(perFrame).toBeLessThan(4);
  expect(errors).toEqual([]);
});

test('in partita: niente frecce, solo pausa → menu HOME / MUSICA / RIPRENDI', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.locator('#homeStart').click();
  await page.waitForFunction(() => (window as any).__sd.game.playerPhase === 'alive', null, { timeout: 30000 });

  // nessun pulsante direzionale né frecce nell'interfaccia
  expect(await page.locator('#btnL, #btnR, .dir').count()).toBe(0);
  expect(await page.evaluate(() => /[◀▶←→]/.test(document.body.innerText))).toBe(false);
  expect(await page.locator('#fire, #pad').count()).toBe(0);
  // della barra resta visibile solo il tastino pausa
  await expect(page.locator('#bar')).toBeHidden();
  await expect(page.locator('#bPause')).toBeVisible();

  await page.locator('#bPause').click();
  await expect(page.locator('#pauseMenu')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__sd.isPaused())).toBe(true);
  await page.screenshot({ path: `${shotDir}/${info.project.name}-pause.png` });

  // MUSICA ON → OFF (e ritorno)
  expect(await page.locator('#mMusic').getAttribute('aria-label')).toBe('MUSICA ON');
  await page.locator('#mMusic').click();
  expect(await page.locator('#mMusic').getAttribute('aria-label')).toBe('MUSICA OFF');
  expect(await page.evaluate(() => (window as any).__sd.audio.musicOn)).toBe(false);
  await page.locator('#mMusic').click();
  expect(await page.evaluate(() => (window as any).__sd.audio.musicOn)).toBe(true);

  // RIPRENDI
  await page.locator('#mResume').click();
  await expect(page.locator('#pauseMenu')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__sd.isPaused())).toBe(false);

  // HOME
  await page.locator('#bPause').click();
  await page.locator('#mHome').click();
  await expect(page.locator('#pauseMenu')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__sd.game.mode)).toBe('title');
  await expect(page.locator('#homeStart')).toBeVisible();
  expect(errors).toEqual([]);
});
