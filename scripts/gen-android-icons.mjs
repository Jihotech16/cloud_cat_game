// Android 런처 아이콘(레거시 + 적응형 포그라운드)을 우리 SVG로 생성한다.
// @capacitor/assets(sharp) 설치가 막힌 환경을 위해 Chromium으로 래스터화.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resDir = resolve(root, 'android/app/src/main/res');
if (!existsSync(resDir)) {
  console.error('android 프로젝트가 없습니다. 먼저 `npx cap add android` 실행.');
  process.exit(1);
}
const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const svg = readFileSync(resolve(root, 'icons/icon.svg'), 'utf8');
// 적응형 포그라운드용: 하늘 배경 사각형 제거(투명)
const fgSvg = svg.replace(/<rect[^>]*url\(#sky\)[^>]*\/>/, '');

const densities = [
  { dir: 'mdpi', legacy: 48, fg: 108 },
  { dir: 'hdpi', legacy: 72, fg: 162 },
  { dir: 'xhdpi', legacy: 96, fg: 216 },
  { dir: 'xxhdpi', legacy: 144, fg: 324 },
  { dir: 'xxxhdpi', legacy: 192, fg: 432 },
];

async function render(page, { size, body, background, pad = 0 }) {
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round(size * pad);
  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0}
    html,body{width:${size}px;height:${size}px;background:${background};overflow:hidden}
    .wrap{position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px}
    svg{width:100%;height:100%;display:block}
  </style></head><body><div class="wrap">${body}</div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'networkidle' });
  return page.screenshot({
    omitBackground: background === 'transparent',
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();

for (const d of densities) {
  const base = resolve(resDir, `mipmap-${d.dir}`);
  // 레거시 정사각/원형(둥근 배경 포함된 전체 아이콘)
  const square = await render(page, { size: d.legacy, body: svg, background: 'transparent' });
  writeFileSync(resolve(base, 'ic_launcher.png'), square);
  writeFileSync(resolve(base, 'ic_launcher_round.png'), square);
  // 적응형 포그라운드(안전영역에 맞춰 약 64% 크기, 투명 배경)
  const fg = await render(page, { size: d.fg, body: fgSvg, background: 'transparent', pad: 0.18 });
  writeFileSync(resolve(base, 'ic_launcher_foreground.png'), fg);
  console.log(`✓ mipmap-${d.dir} (${d.legacy}/${d.fg})`);
}

await browser.close();

// 적응형 배경색을 하늘색으로
const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#6EC6FF</color>
</resources>
`;
writeFileSync(resolve(resDir, 'values/ic_launcher_background.xml'), bgXml);
console.log('✓ ic_launcher_background → #6EC6FF');
