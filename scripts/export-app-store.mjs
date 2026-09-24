import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against the unmodified game served from the repository root.
const root = process.cwd();
const language = process.argv[2] || 'ko';
const translations = {
  en: [
    ['ONE MORE JUMP!', 'Hold. Release.\nHello, sky!', 'A little cat. A big adventure above the clouds.'],
    ['CLOUDS WITH A TWIST', 'New clouds.\nNew surprises.', 'Bounce, switch direction, and leap before they fade!'],
    ['A LITTLE SKY ENCOUNTER', 'Shh… a whale\nis sleeping!', 'Meet a sleepy balloon whale among the clouds.'],
    ['ADVENTURE MODE', 'Collect orbs.\nGrow stronger.', 'Pick your powers and make each run your own.'],
    ['DRESS UP YOUR CAT', 'Cloud pajamas?\nYes, please!', 'Collect coins to unlock a cozy new look.'],
  ],
  ja: [
    ['もう一回、ぴょん！', '長押し、ジャンプ！\n空の彼方へ', '指先ひとつで、ねこと雲の旅へ。'],
    ['いろんな雲の足場', '雲が変われば\n楽しさも変わる', '弾んで、向きを変えて、消える前にジャンプ！'],
    ['空で出会う小さな友だち', 'しーっ、クジラが\nお昼寝中', '雲の間に浮かぶ、眠たい風船クジラ。'],
    ['アドベンチャーモード', '集めるほどに\n冒険が広がる', 'オーブを集めて、自分だけの能力を選ぼう。'],
    ['ねこを着せ替え', '今日は\n雲のパジャマ！', 'コインを集めて、かわいい衣装に着替えよう。'],
  ],
  zh: [
    ['再跳一次！', '长按蓄力\n跃上云端！', '指尖轻轻一跃，开启猫咪的云端之旅。'],
    ['多样云朵平台', '每一朵云\n都有新惊喜', '弹跳、转向，在云朵消失前跃起！'],
    ['云端的小小邂逅', '嘘，小鲸鱼\n睡着啦！', '遇见云朵间悠然漂浮的气球鲸鱼。'],
    ['冒险模式', '收集能量\n让冒险升级', '收集能量球，选择属于你的能力。'],
    ['装扮你的猫咪', '今天穿上\n云朵睡衣！', '收集金币，解锁可爱的猫咪装扮。'],
  ],
};
if (!['ko', ...Object.keys(translations)].includes(language)) throw new Error('Unsupported language');
const locale = {ko:'ko-KR',en:'en-US',ja:'ja-JP',zh:'zh-CN'}[language];
const font = {ko:"'Apple SD Gothic Neo'",en:"'Arial'",ja:"'Hiragino Kaku Gothic ProN'",zh:"'PingFang SC'"}[language];
const out = path.join(root, 'output/app-store', language);
await mkdir(path.join(out, 'sources'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 660 }, deviceScaleFactor: 3,
  isMobile: true, hasTouch: true, locale,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
});
await context.addInitScript(lang => localStorage.setItem('cloudCat_lang', lang), language);
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/js/main.js', async route => {
  const source = await readFile(path.join(root, 'js/main.js'), 'utf8');
  await route.fulfill({ contentType: 'text/javascript', body: source.replace('game = new Game(', 'game = window.captureGame = new Game(') });
});
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
await page.locator('#btn-start').click();
await page.waitForFunction(() => window.captureGame);
await page.evaluate(() => cancelAnimationFrame(window.captureGame._loopId));

const scenes = [
  { id: '01-jump', tag: '한 번 더, 폴짝!', title: '꾹 누르고,\n하늘까지!', sub: '손끝에서 시작되는 고양이의 구름 여행', score: 84, color: '#e9f7ff', accent: '#257cac' },
  { id: '02-clouds', tag: '다채로운 구름 발판', title: '구름마다\n새로운 재미', sub: '튀어 오르고, 방향을 바꾸고, 사라지고!', score: 176, color: '#eaf9f3', accent: '#3a847a' },
  { id: '03-whale', tag: '하늘 위의 작은 만남', title: '쉿, 고래가\n자고 있어요', sub: '구름 사이에 떠 있는 잠든 풍선 고래', score: 265, color: '#fff2e8', accent: '#a26449' },
  { id: '04-adventure', tag: '어드벤처 모드', title: '모을수록\n커지는 모험', sub: '오브를 모으고, 나만의 능력을 골라요', score: 410, color: '#f0ebff', accent: '#7760aa' },
  { id: '05-costume', tag: '나만의 고양이', title: '오늘은\n구름 잠옷!', sub: '코인을 모아 귀여운 복장을 만나세요', score: 42, color: '#fff5dc', accent: '#98782d' },
];
if (translations[language]) scenes.forEach((s,i) => {
  [s.tag,s.title,s.sub] = translations[language][i];
});
for (let index = 0; index < scenes.length; index++) {
  const scene = scenes[index];
  await page.evaluate(async ({ index, score }) => {
    const { Cloud, CLOUD_TYPES: T } = await import('/js/cloud.js');
    const { BalloonWhale } = await import('/js/whale.js');
    const { Orb } = await import('/js/orb.js');
    const { CoinPickup } = await import('/js/coin.js');
    const { LetterToken } = await import('/js/letters.js');
    const { setPlayerSkin } = await import('/js/player.js');
    const g = window.captureGame;
    cancelAnimationFrame(g._loopId);
    g.state = 'playing'; g.score = score; g.frame = 140; g.cameraY = 0;
    g.mode = index === 3 ? 'adventure' : 'classic';
    g.clouds = []; g.orbs = []; g.hazards = []; g.letters = []; g.coinPickups = [];
    g.particles = []; g.floatTexts = []; g.banner = null;
    const positions = [[98,590],[259,490],[124,385],[278,279],[114,180],[266,76]];
    const kinds = index === 1 ? [T.NORMAL,T.DIRECTION,T.GLASS,T.BOUNCE,T.THUNDER,T.NORMAL] : [T.NORMAL,T.NORMAL,T.NORMAL,T.MOVING,T.NORMAL,T.NORMAL];
    g.clouds = positions.map(([x,y], i) => new Cloud(x,y,kinds[i]));
    if (index === 2) g.clouds[2] = new BalloonWhale(154,370);
    if (index === 3) {
      g.orbs = [new Orb(212,436),new Orb(171,344),new Orb(231,220,'rainbow'),new Orb(168,141)];
      g.letters = [new LetterToken(275,247,2)];
    } else {
      g.coinPickups = [new CoinPickup(175,329),new CoinPickup(225,224)];
    }
    setPlayerSkin(index === 4 ? 'pajamas' : 'default');
    g.player.x = index === 2 ? 239 : 192;
    g.player.y = index === 2 ? 463 : 432;
    g.player.vy = -8; g.player.vx = 2; g.player.facing = 1;
    g.player.groundedCloud = null; g.player.jumpPeakVy = 14;
    if (index === 4) {
      g.player.x = 259; g.player.groundedCloud = g.clouds[1];
      g.player.alignFeetTo(g.clouds[1].top); g.player.vy = 0; g.player.jumpPeakVy = 0;
    }
    g.callbacks.onScore?.(score);
    g.callbacks.onCoins?.(index === 3 ? 24 : 8);
    g.callbacks.onGauge?.(index === 3 ? 0.64 : 0);
    g.callbacks.onLetters?.(index === 3 ? new Set([0,1]) : new Set());
    document.querySelector('.gauge').style.display = index === 3 ? '' : 'none';
    document.querySelector('#best-score').textContent = String(score);
    document.querySelector('#global-best').textContent = '—';
    // No score is saved or submitted: this is a locally staged renderer capture.
  }, { index, score: scene.score });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.captureGame._draw());
  await page.screenshot({ path: path.join(out, 'sources', `${scene.id}.png`) });
}

const design = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
for (let i = 0; i < scenes.length; i++) {
  const s = scenes[i];
  const shot = (await readFile(path.join(out, 'sources', `${s.id}.png`))).toString('base64');
  const html = `<!doctype html><html lang="${language}"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;width:440px;height:956px;overflow:hidden;background:${s.color};color:#283950;font-family:${font},sans-serif}
    .brand{position:absolute;top:27px;left:34px;font:900 22px/1 'Arial Rounded MT Bold',sans-serif;letter-spacing:2px;color:${s.accent}}
    .edition{position:absolute;right:34px;top:31px;font-size:10px;letter-spacing:1.4px;font-weight:800;color:${s.accent}}
    header{position:absolute;top:77px;left:34px;right:24px;z-index:2}.tag{font-size:13px;font-weight:800;letter-spacing:.5px;color:${s.accent};margin-bottom:12px}
    h1{font-size:${language==='ja'?36:language==='en'?43:49}px;line-height:1.18;letter-spacing:${language==='en'?'-1.8':'-1.4'}px;font-weight:900;margin:0;white-space:pre-line}p{font-size:${language==='ja'?13:14}px;font-weight:500;letter-spacing:-.3px;margin:16px 0 0;color:#596677;line-height:1.5}
    .shot{position:absolute;left:30px;top:288px;width:380px;border:5px solid #ffffff;border-radius:26px;overflow:hidden;box-shadow:0 15px 30px #374f7220;background:#a5d9fa}
    .shot img{display:block;width:370px;height:auto}.orb{position:absolute;width:220px;height:220px;border-radius:50%;background:#ffffff65;right:-80px;top:135px}
    .footer{position:absolute;bottom:9px;left:0;width:100%;text-align:center;font-size:9px;letter-spacing:1.8px;color:${s.accent}}
  </style><div class="orb"></div><div class="brand">POING</div><div class="edition">CLOUD JUMP</div><header><div class="tag">${s.tag}</div><h1>${s.title}</h1><p>${s.sub}</p></header><div class="shot"><img src="data:image/png;base64,${shot}"></div><div class="footer">${String(i+1).padStart(2,'0')} / 05 · POING: CLOUD JUMP</div></html>`;
  await writeFile(path.join(out, 'sources', `${s.id}.html`), html);
  await design.setContent(html);
  await design.evaluate(() => document.fonts.ready);
  const bounds = await design.evaluate(() => ({header:document.querySelector('header').getBoundingClientRect().bottom,shot:document.querySelector('.shot').getBoundingClientRect().top, overflow:document.querySelector('h1').scrollWidth > document.querySelector('h1').clientWidth}));
  if (bounds.header > bounds.shot - 12 || bounds.overflow) throw new Error(`Text overflow ${language}/${s.id}: ${JSON.stringify(bounds)}`);
  await design.screenshot({ path: path.join(out, `${s.id}.png`), omitBackground: false });
}
await design.setViewportSize({ width: 1100, height: 478 });
const thumbs = await Promise.all(scenes.map(async s => `<img src="data:image/png;base64,${(await readFile(path.join(out, `${s.id}.png`))).toString('base64')}">`));
await design.setContent(`<style>body{margin:0;display:flex;background:#fff}img{width:220px;height:478px}</style>${thumbs.join('')}`);
await design.screenshot({ path: path.join(out, 'preview.png'), scale: 'css' });
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ size: [1320,2868], locale, format:'PNG RGB, opaque', provenance:'Game renderer captures, staged local scenes using actual production assets and HUD. No gameplay asset edits; no uploads or saved scores.', sources:'sources/*.png are raw game captures; sources/*.html are editable text compositions.', specs:'https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications', scenes, errors }, null, 2));
await browser.close();
console.log(JSON.stringify({ out, errors, files: scenes.map(s => `${s.id}.png`) }));
