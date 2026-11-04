// Screenshot della home (primo avvio e con record) e della schermata "NUOVO RECORD".
import { chromium, devices } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ ...devices['iPhone 13'] });
await p.addInitScript(() => localStorage.setItem('sd.installhint', '1'));
await p.goto('http://localhost:4199/');
await p.waitForTimeout(3000);
await p.screenshot({ path: 'tests/e2e/screens/home-first.png' });
await p.locator('#homeStart').click();
await p.evaluate(() => { const g = __sd.game; g.skipToPlay(); g.addScore(12340); g.lives = 1; g.hitPlayer(0); });
await p.waitForFunction(() => __sd.game.phase === 'record', null, { timeout: 60000 });
await p.waitForTimeout(800);
await p.screenshot({ path: 'tests/e2e/screens/record.png' });
await p.waitForFunction(() => __sd.game.mode === 'title', null, { timeout: 30000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: 'tests/e2e/screens/home-record.png' });
await b.close();
