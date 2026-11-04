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
  await page.locator('#tap').click();
  await expect(page.locator('#tap')).toBeHidden();
}

test('layout: niente scroll, canvas in proporzione e dentro lo schermo, controlli raggiungibili', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const c = document.getElementById('screen')!.getBoundingClientRect();
    const r = (id: string) => { const b = document.getElementById(id)!.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, vis: getComputedStyle(document.getElementById(id)!).display !== 'none' }; };
    return {
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
      sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
      c: { x: c.left, y: c.top, w: c.width, h: c.height },
      fire: r('fire'), pad: r('pad'), bar: r('bar'),
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
  if (m.touch) {
    for (const z of [m.fire, m.pad]) {
      expect(z.vis).toBe(true);
      expect(z.w).toBeGreaterThan(60);
      expect(z.x).toBeGreaterThanOrEqual(0);
      expect(z.x + z.w).toBeLessThanOrEqual(m.vw + 0.5);
      expect(z.y + z.h).toBeLessThanOrEqual(m.vh + 0.5);
      // i controlli non coprono l'area di gioco
      const overlap = !(z.x >= m.c.x + m.c.w || z.x + z.w <= m.c.x || z.y >= m.c.y + m.c.h || z.y + z.h <= m.c.y);
      expect(overlap).toBe(false);
    }
  }
  await page.screenshot({ path: `${shotDir}/${info.project.name}-title.png` });
  expect(errors).toEqual([]);
});

test('gioco: parte, si muove, spara e mantiene il frame time', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => (window as any).__sd.game.startGame('game'));
  await page.waitForFunction(() => (window as any).__sd.game.playerPhase === 'alive', null, { timeout: 30000 });
  if ((await page.locator('#fire').isVisible())) {
    await page.locator('#fire').dispatchEvent('pointerdown', { pointerId: 7, isPrimary: true });
    await page.waitForFunction(() => (window as any).__sd.game.shots > 0, null, { timeout: 10000 });
    await page.locator('#fire').dispatchEvent('pointerup', { pointerId: 7 });
  } else {
    await page.keyboard.down('Space');
    await page.waitForFunction(() => (window as any).__sd.game.shots > 0, null, { timeout: 10000 });
    await page.keyboard.up('Space');
  }
  const shots = await page.evaluate(() => (window as any).__sd.game.shots);
  expect(shots).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${shotDir}/${info.project.name}-play.png` });
  const perf = await page.evaluate(() => ({ frame: (window as any).__sd.loop.frameMs, work: (window as any).__sd.loop.workMs }));
  console.log(`[${info.project.name}] frame ${perf.frame.toFixed(1)} ms, lavoro CPU ${perf.work.toFixed(2)} ms`);
  // il costo per frame deve stare ben dentro il budget di 16,7 ms (60 fps)
  expect(perf.work).toBeLessThan(8);
  expect(errors).toEqual([]);
});
