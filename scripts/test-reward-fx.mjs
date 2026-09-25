import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import { REWARD_FX } from '../js/reward-fx.js';

const origin = process.env.REWARD_TEST_ORIGIN || 'http://127.0.0.1:8767';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/js/main.js', async route => {
    const body = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8').replace(/boot\(\);\s*$/, '') + `
      window.rewardTest = async () => {
        const { REWARDS } = await import('./orb.js');
        document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
        app.classList.remove('hidden');
        document.getElementById('desktop-gate').style.display = 'none';
        document.getElementById('landscape-gate').style.display = 'none';
        window.applied = [];
        game = {state:'reward', player:{x:195,y:580}, cameraY:0, worldWidth:390, worldHeight:844,
          chooseReward(id){window.applied.push(id);this.state='playing'},
          rerollReward(){window.applied.push('REROLL')},skipReward(){window.applied.push('SKIP')}};
        showRewardChoices(REWARDS.filter(r => ['jump','magnet','shield'].includes(r.id)), {coins:100,rerollCost:10});
        return REWARDS.map(r => r.id);
      };`;
    await route.fulfill({ contentType: 'text/javascript', body });
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.rewardTest);
  const ids = await page.evaluate(() => window.rewardTest());
  assert.equal(ids.length, 23);
  for (const id of ids) {
    assert.ok(REWARD_FX[id], id);
    assert.ok(existsSync(new URL(`../assets/reward-cards/${id}-card.png`, import.meta.url)), id);
  }
  await page.locator('.reward-art img').first().evaluate(img => img.decode());
  await page.screenshot({ path: '/tmp/poing-reward-before.png' });
  await page.locator('.reward-card').first().click({ force: true });
  await page.evaluate(() => {
    document.querySelector('.reward-card').click();
    document.getElementById('btn-reroll').click();
    document.getElementById('btn-skip').click();
  });
  assert.equal(await page.locator('.reward-fx-layer').count(), 1);
  assert.deepEqual(await page.evaluate(() => window.applied), []);
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/poing-reward-during.png' });
  await page.waitForFunction(() => window.applied.length === 1);
  assert.deepEqual(await page.evaluate(() => window.applied), ['jump']);
  assert.equal(await page.locator('.reward-fx-layer').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.rewardTest());
  await page.locator('.reward-card').nth(1).click({ force: true });
  await page.waitForFunction(() => window.applied.length === 1);
  assert.deepEqual(await page.evaluate(() => window.applied), ['magnet']);
  // Dismissed screen must not apply an obsolete selection.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.rewardTest());
  await page.locator('.reward-card').first().click({ force: true });
  await page.evaluate(() => document.getElementById('reward-screen').classList.add('hidden'));
  await page.waitForTimeout(1000);
  assert.deepEqual(await page.evaluate(() => window.applied), []);
  assert.equal(await page.locator('.reward-fx-layer').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: 23 assets/effect mappings, single selection, action lock, cleanup, reduced motion, dismissal.');
} finally { await browser.close(); }
