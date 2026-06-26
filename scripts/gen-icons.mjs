// SVG 아이콘(icons/icon.svg)을 PWA / Capacitor용 PNG로 렌더링한다.
// 이미지 라이브러리(sharp) 바이너리 다운로드가 막힌 환경을 위해
// 미리 설치된 Chromium(Playwright)으로 래스터화한다.
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const svg = readFileSync(resolve(root, 'icons/icon.svg'), 'utf8');

// purpose: any → 투명 배경 / maskable → 안전영역 패딩(80%)
const targets = [
  { out: 'icons/icon-192.png', size: 192, pad: 0 },
  { out: 'icons/icon-512.png', size: 512, pad: 0 },
  { out: 'icons/icon-maskable-512.png', size: 512, pad: 0.1 },
  { out: 'resources/icon.png', size: 1024, pad: 0 }, // @capacitor/assets 소스
  { out: 'resources/splash.png', size: 2732, pad: 0.42, bg: '#6ec6ff' }, // 스플래시 소스
];

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();

for (const { out, size, pad, bg } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round(size * pad);
  const background = bg ?? 'transparent';
  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0}
    html,body{width:${size}px;height:${size}px;background:${background};overflow:hidden}
    .wrap{position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px}
    svg{width:100%;height:100%;display:block}
  </style></head><body><div class="wrap">${svg}</div></body></html>`;

  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'networkidle' });
  mkdirSync(resolve(root, dirname(out)), { recursive: true });
  const buf = await page.screenshot({
    omitBackground: background === 'transparent',
    clip: { x: 0, y: 0, width: size, height: size },
  });
  writeFileSync(resolve(root, out), buf);
  console.log(`✓ ${out} (${size}px)`);
}

await browser.close();
