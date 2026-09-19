import assert from 'node:assert/strict';
globalThis.Image = class {};
const { BalloonWhale } = await import('../js/whale.js');
const { Player } = await import('../js/player.js');
const whale = new BalloonWhale(300, 300);
const player = new Player(300, 500);
const hitAt = (x0, y0, x1, y1) => {
  player.x = x1; player.y = y1;
  return whale.contact(player, { x: x0, y: y0 });
};
assert.equal(hitAt(300, 500, 300, 100).side, 'bottom', 'fast upward jump hits belly');
assert.equal(hitAt(300, 100, 300, 500).side, 'top', 'falling lands on back');
assert.equal(hitAt(100, 300, 500, 300).side, 'left');
assert.equal(hitAt(500, 300, 100, 300).side, 'right');
assert.equal(hitAt(50, 500, 50, 100), null, 'passing outside body is safe');
player.alignFeetTo(whale.top);
const launchY = player.y;
assert.equal(hitAt(300, launchY, 300, launchY - 20), null, 'jump off back does not stick');
const hit = hitAt(300, 500, 300, 200);
player.vy = -30;
whale.deflect(player, hit);
assert.ok(player.vy > 0 && player.vy <= 5);
assert.ok(player.y - player.height * 0.36 > whale.belly);
assert.equal(player.groundedCloud, null);
assert.equal(whale.awakeTicks, 24);
const side = hitAt(100, 300, 300, 300);
player.vx = 7;
whale.deflect(player, side);
assert.ok(player.vx < 0);
assert.ok(player.x + player.width * 0.3 < whale.x - whale.width / 2);
// 부딪힌 고래는 발판이 아니게 되고 위로 달아난다.
assert.equal(whale.fleeing, true, 'bumped whale flees');
assert.equal(whale.isSolid, false, 'fleeing whale is not a platform');
assert.equal(whale.broken, false);

// 좌우로 떠다니는 움직임은 부딪히지 않은 고래로 확인한다.
const drifter = new BalloonWhale(300, 300);
const initialX = drifter.x;
for (let i = 0; i < 1000; i++) {
  const old = drifter.x;
  drifter.update(780, 0.5);
  assert.ok(Math.abs(drifter.x - initialX) <= 28.001);
  assert.equal(drifter.deltaX, drifter.x - old);
}
assert.equal(drifter.awakeTicks, 0, 'returns to sleep');
assert.equal(drifter.isSolid, true);
console.log('PASS: swept belly/sides/back, near miss, jump release, soft response, drift, sleep reset');

// 부딪히면 위로 달아나고, 그 뒤로는 발판·장애물이 아니다.
const runaway = new BalloonWhale(300, 300);
const bumper = new Player(300, 500);
const bump = (() => { bumper.x = 300; bumper.y = 200; return runaway.contact(bumper, { x: 300, y: 500 }); })();
runaway.deflect(bumper, bump);
assert.equal(runaway.fleeing, true, 'bump makes the whale flee');
assert.equal(runaway.isSolid, false, 'fleeing whale is no longer a platform');
const startY = runaway.y;
for (let i = 0; i < 60; i++) runaway.update(400, 1);
assert.ok(startY - runaway.y > 100, 'flees upward quickly');
assert.equal(runaway.dead, false);
for (let i = 0; i < 400; i++) runaway.update(400, 1);
assert.equal(runaway.dead, true, 'despawns after flying far away');
console.log('PASS: bump makes the whale fly away');
