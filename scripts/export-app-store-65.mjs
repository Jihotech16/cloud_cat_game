import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Size-only derivatives: preserve approved copy and artwork without cropping.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3 });
  for (const lang of ['ko', 'en', 'ja', 'zh']) {
    const source = path.resolve('output/app-store', lang);
    const out = path.join(source, 'iphone-65');
    await mkdir(out, { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
    for (const scene of manifest.scenes) {
      const png = (await readFile(path.join(source, `${scene.id}.png`))).toString('base64');
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${scene.color}}img{display:block;width:100%;height:100%;object-fit:contain}</style><img src="data:image/png;base64,${png}">`);
      await page.locator('img').evaluate(img => img.decode());
      await page.screenshot({ path: path.join(out, `${scene.id}.png`), omitBackground: false });
    }
    await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ ...manifest, size: [1284,2778], source: '../*.png', transformation: 'Proportional contain; no crop or distortion; tiny side padding matches scene background.' }, null, 2));
    console.log(`${lang}: 5 images exported at 1284x2778`);
  }
} finally { await browser.close(); }
