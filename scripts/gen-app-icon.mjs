// 래스터 소스(resources/icon-source.png)에서 앱 아이콘 일체를 생성한다.
// - 검정 배경/여백을 가장자리 플러드필로 투명 처리 후 라운드 아이콘만 크롭
// - PWA(any): 투명 코너 / maskable·iOS·Android: 배경색으로 채운 풀블리드
// sharp 설치가 막힌 환경이라 Chromium 캔버스로 처리한다.
import pkg from 'playwright-core';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const { chromium } = pkg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resDir = resolve(root, 'android/app/src/main/res');
const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8155;

// 정적 서버(소스 이미지 로드용)
const { createServer } = await import('node:http');
const { readFile } = await import('node:fs/promises');
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!DOCTYPE html><html><body></body></html>');
    return;
  }
  try {
    const buf = await readFile(resolve(root, req.url.slice(1)));
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });

// 브라우저 컨텍스트: 소스 전처리(검정 제거 + 크롭) 후 헬퍼를 window에 노출
await page.evaluate(async (port) => {
  const img = new Image();
  img.src = `http://127.0.0.1:${port}/resources/icon-source.png`;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  const sctx = src.getContext('2d');
  sctx.drawImage(img, 0, 0);
  const id = sctx.getImageData(0, 0, W, H);
  const d = id.data;

  // 가장자리에서 near-black 플러드필 → 투명
  const isBlack = (i) => d[i] <= 18 && d[i + 1] <= 18 && d[i + 2] <= 18;
  const stack = [];
  const push = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) stack.push(y * W + x); };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  const seen = new Uint8Array(W * H);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue; seen[p] = 1;
    const i = p * 4;
    if (!isBlack(i)) continue;
    d[i + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  sctx.putImageData(id, 0, 0);

  // 불투명 영역 bbox 크롭
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 8) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cw; cropped.height = ch;
  cropped.getContext('2d').drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);

  // 테두리(상단 우드 프레임) 색 샘플 → 배경 채움색
  const tctx = cropped.getContext('2d');
  let r = 0, g = 0, bl = 0, n = 0;
  const yy = Math.round(ch * 0.06);
  for (let x = Math.round(cw * 0.3); x < cw * 0.7; x++) {
    const px = tctx.getImageData(x, yy, 1, 1).data;
    if (px[3] > 200) { r += px[0]; g += px[1]; bl += px[2]; n++; }
  }
  window.__bg = n ? `rgb(${(r / n) | 0},${(g / n) | 0},${(bl / n) | 0})` : '#7a4a23';
  window.__cropped = cropped;

  // size 픽셀의 정사각 PNG dataURL 생성
  // mode: 'any'(투명코너 fit) | 'bleed'(배경색 채워 꽉참) | 'fg'(배경투명, 안전영역 축소)
  window.__make = (size, mode, pad = 0) => {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (mode === 'bleed') {
      ctx.fillStyle = window.__bg;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(window.__cropped, 0, 0, size, size);
    } else {
      const inner = Math.round(size * (1 - pad * 2));
      const off = Math.round(size * pad);
      ctx.drawImage(window.__cropped, off, off, inner, inner);
    }
    return c.toDataURL('image/png');
  };
}, PORT);

const bg = await page.evaluate(() => window.__bg);

async function save(relPath, size, mode, pad = 0) {
  const url = await page.evaluate(([s, m, p]) => window.__make(s, m, p), [size, mode, pad]);
  const out = resolve(root, relPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`✓ ${relPath} (${size}, ${mode})`);
}

// PWA / 웹 (any: 투명 코너)
await save('icons/icon-192.png', 192, 'any');
await save('icons/icon-512.png', 512, 'any');
// maskable / iOS / Capacitor 소스 (풀블리드)
await save('icons/icon-maskable-512.png', 512, 'bleed');
await save('resources/icon.png', 1024, 'bleed');

// Android 런처 아이콘
if (existsSync(resDir)) {
  const dens = [
    ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
  ];
  for (const [name, legacy, fg] of dens) {
    await save(`android/app/src/main/res/mipmap-${name}/ic_launcher.png`, legacy, 'bleed');
    await save(`android/app/src/main/res/mipmap-${name}/ic_launcher_round.png`, legacy, 'bleed');
    // 적응형 포그라운드: 안전영역(약 64%)에 축소, 배경은 색 레이어가 담당
    await save(`android/app/src/main/res/mipmap-${name}/ic_launcher_foreground.png`, fg, 'fg', 0.18);
  }
  const hex = `#${bg.match(/\d+/g).map((v) => (+v).toString(16).padStart(2, '0')).join('')}`;
  writeFileSync(
    resolve(resDir, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${hex}</color>\n</resources>\n`,
  );
  console.log(`✓ ic_launcher_background → ${hex}`);
}

await browser.close();
server.close();
console.log('배경색:', bg);
