// Android 스플래시 이미지를 브랜드(하늘색 배경 + 중앙 로고)로 생성한다.
// Chromium으로 SVG를 래스터화(sharp 설치 불가 환경 대응).
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resDir = resolve(root, 'android/app/src/main/res');
if (!existsSync(resDir)) {
  console.error('android 프로젝트가 없습니다. 먼저 `npx cap add android`.');
  process.exit(1);
}
const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = readFileSync(resolve(root, 'icons/icon.svg'), 'utf8');
const BG = '#6ec6ff';

// Capacitor 기본 스플래시 경로별 크기
const targets = [
  ['drawable/splash.png', 480, 320],
  ['drawable-port-mdpi/splash.png', 320, 480],
  ['drawable-port-hdpi/splash.png', 480, 800],
  ['drawable-port-xhdpi/splash.png', 720, 1280],
  ['drawable-port-xxhdpi/splash.png', 960, 1600],
  ['drawable-port-xxxhdpi/splash.png', 1280, 1920],
  ['drawable-land-mdpi/splash.png', 480, 320],
  ['drawable-land-hdpi/splash.png', 800, 480],
  ['drawable-land-xhdpi/splash.png', 1280, 720],
  ['drawable-land-xxhdpi/splash.png', 1600, 960],
  ['drawable-land-xxxhdpi/splash.png', 1920, 1280],
];

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();

for (const [out, w, h] of targets) {
  const logo = Math.round(Math.min(w, h) * 0.4);
  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0}
    html,body{width:${w}px;height:${h}px;background:${BG};overflow:hidden}
    .c{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${logo}px;height:${logo}px}
    svg{width:100%;height:100%;display:block}
  </style></head><body><div class="c">${svg}</div></body></html>`;
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(resolve(resDir, out), buf);
  console.log(`✓ ${out} (${w}x${h})`);
}

await browser.close();
