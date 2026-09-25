// Screen-anchored event, never a landable platform. Times are 60 Hz game ticks.
export const LIGHTNING_WARNING = 90;
export const LIGHTNING_STRIKE = 12;
export const LIGHTNING_FADE = 30;
let sprite;
if (typeof Image !== 'undefined') {
  sprite = new Image();
  sprite.src = 'assets/cloud-thunder-cycle-sheet.png';
}

export class LightningEvent {
  constructor(x) { this.x = x; this.age = 0; this.hit = false; }
  update(dt = 1) { this.age += dt; }
  get striking() { return this.age >= LIGHTNING_WARNING && this.age < LIGHTNING_WARNING + LIGHTNING_STRIKE; }
  get dead() { return this.age >= LIGHTNING_WARNING + LIGHTNING_STRIKE + LIGHTNING_FADE; }
  geometry(width, height) {
    const cloudWidth = Math.min(128, width * .32);
    const top = Math.min(70, height * .12);
    const cloudHeight = cloudWidth * 34 / 128;
    return { cloudWidth, cloudHeight, top, boltTop: top + cloudHeight * .8, bottom: height, halfWidth: 10 };
  }
  intersects(previous, player, cameraY, width, height) {
    if (!this.striking || this.hit) return false;
    const g = this.geometry(width, height);
    const half = player.width * .28;
    return Math.max(previous.x, player.x) + half > this.x - g.halfWidth
      && Math.min(previous.x, player.x) - half < this.x + g.halfWidth
      && Math.max(previous.y, player.y) + player.height * .5 > cameraY + g.boltTop
      && Math.min(previous.y, player.y) - player.height * .3 < cameraY + g.bottom;
  }
  draw(ctx, width, height) {
    const g = this.geometry(width, height);
    const warning = this.age < LIGHTNING_WARNING;
    const fade = Math.max(0, 1 - (this.age - LIGHTNING_WARNING - LIGHTNING_STRIKE) / LIGHTNING_FADE);
    ctx.save();
    // The same fixed column is shown before the strike; it never tracks the cat.
    if (warning) {
      ctx.fillStyle = `rgba(255,218,112,${.07 + .04 * Math.sin(this.age * .12)})`;
      ctx.fillRect(this.x - g.halfWidth, g.boltTop, g.halfWidth * 2, height - g.boltTop);
      ctx.strokeStyle = '#ffdf8a'; ctx.globalAlpha = .55;
      ctx.lineWidth = 1; ctx.setLineDash([5, 9]);
      ctx.beginPath();ctx.moveTo(this.x,g.boltTop);ctx.lineTo(this.x,height);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha = Math.min(1, this.age / 15);
    } else {
      ctx.globalAlpha = this.striking ? 1 : fade * .4;
      // One continuous, narrow jagged bolt from the cloud to the viewport floor.
      const points = [[this.x,g.boltTop]];
      for (let y=g.boltTop+18,i=0;y<height;y+=22,i++) points.push([this.x + [6,-5,3,-7][i%4],y]);
      points.push([this.x,height]);
      ctx.lineJoin='miter';
      for (const [color,lineWidth] of [['rgba(173,143,255,.22)',24],['#b9a1ff',12],['#fff1a6',6],['#ffffff',2]]) {
        ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();
        points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
      }
      ctx.globalAlpha = this.striking ? 1 : fade;
    }
    if (sprite?.complete && sprite.naturalWidth) {
      const frame = warning ? (this.age > 60 ? 4 : Math.floor(this.age/18)%4) : this.striking ? 5 : 6;
      const fw=sprite.naturalWidth/7;
      ctx.imageSmoothingEnabled=false;
      // Crop off the original short bolt; the full-height effect above replaces it.
      ctx.drawImage(sprite,frame*fw,0,fw,34,this.x-g.cloudWidth/2,g.top,g.cloudWidth,g.cloudHeight);
    } else {
      ctx.fillStyle='#686781';ctx.beginPath();ctx.ellipse(this.x,g.top+g.cloudHeight/2,g.cloudWidth/2,g.cloudHeight/2,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}
