import assert from 'node:assert/strict';

const images = [];
globalThis.Image = class {
  constructor() { images.push(this); }
};
const { Player, setPlayerSkin } = await import('../js/player.js');
const idle = images.find(image => image.src === 'assets/cat-idle-sheet.png');
const cat = images.find(image => image.src === 'assets/cat.png');
const ready = images.find(image => image.src === 'assets/cat_jumpready.png');
const jumping = images.find(image => image.src === 'assets/cat_jumping.png');
cat.onload();
ready.onload();
jumping.onload();
const player = new Player(100, 100);
const calls = [];
const ctx = {
  save() {}, restore() {}, translate() {}, scale() {},
  drawImage(...args) { calls.push(args); },
};
const render = () => { calls.length = 0; player.draw(ctx, 0); return calls.at(-1); };
assert.equal(render()[0], cat, 'unloaded idle falls back to original cat');
idle.naturalWidth = 1; idle.naturalHeight = 1; idle.onload();
assert.equal(render()[0], cat, 'invalid sheet falls back safely');
idle.naturalWidth = 512; idle.naturalHeight = 128; idle.onload();
for (const [ms, frame] of [[0,0], [1099,0], [1100,1], [1649,1], [1650,2], [1769,2], [1770,3], [2419,3]]) {
  player.idleElapsedMs = ms;
  assert.equal(player._getIdleFrame(), frame);
  const draw = render();
  assert.equal(draw[0], idle);
  assert.equal(draw[1], frame * 128);
}
player.idleElapsedMs = 2419;
player.tickAnim();
assert.equal(player._getIdleFrame(), 0, 'cycle loops');
player.groundedCloud = {};
player.charging = true;
player.chargeLevel = 0.5;
player.tickAnim();
assert.equal(player.idleElapsedMs, 0);
assert.equal(render()[0], ready, 'charging keeps existing sprite');
player.bounce(10);
player.tickAnim();
assert.equal(render()[0], jumping, 'jump keeps existing sprite');
player.land();
player.groundedCloud = {};
player.tickAnim();
assert.equal(render()[0], idle, 'landing returns to idle');
// 복장별 대기 시트: 불러오기 전에는 기본 고양이 시트, 불러온 뒤에는 복장 시트 + 위치 보정
setPlayerSkin('witch');
const witchIdle = images.find(image => image.src === 'assets/cat-witch-idle-sheet.png');
assert.ok(witchIdle, 'witch idle sheet requested when equipped');
player.idleElapsedMs = 1650;
assert.equal(render()[0], idle, 'unloaded skin sheet falls back to default sheet');
witchIdle.naturalWidth = 512; witchIdle.naturalHeight = 128; witchIdle.onload();
const witchDraw = render();
assert.equal(witchDraw[0], witchIdle);
assert.equal(witchDraw[1], 2 * 128, 'skin sheet uses same frame timing');
const unit = Player.DISPLAY_SIZE / 128;
assert.equal(witchDraw[5], -Player.DISPLAY_SIZE / 2 + 2 * unit, 'witch sheet shifted by idleSheetDx');
assert.equal(witchDraw[6], -Player.DISPLAY_SIZE / 2 + 1 * unit, 'unscaled sheet keeps feet offset');
// 잠옷: 1.15배로 키워도 발끝(시트 y 112 + 보정 1) 위치는 그대로
setPlayerSkin('pajamas');
const pajamaIdle = images.find(image => image.src === 'assets/cat-cloud-pajamas-idle-sheet.png');
pajamaIdle.naturalWidth = 512; pajamaIdle.naturalHeight = 128; pajamaIdle.onload();
const pj = render();
assert.equal(pj[0], pajamaIdle);
assert.ok(Math.abs(pj[7] - Player.DISPLAY_SIZE * 1.15) < 1e-9, 'pajama idle drawn 1.15x');
const feet = (draw, scale) => draw[6] + 112 * unit * scale;
assert.ok(Math.abs(feet(pj, 1.15) - feet(witchDraw, 1)) < 1e-9, 'scaled sheet keeps the same feet line');
setPlayerSkin('default');
assert.equal(render()[5], -Player.DISPLAY_SIZE / 2 + 9 * unit, 'default sheet aligned to ready frame');
console.log('PASS: idle loading, frame timing, loop, charge, jump, landing, per-skin sheets');
