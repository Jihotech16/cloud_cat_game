import assert from 'node:assert/strict';
import { LightningEvent } from '../js/lightning.js';
import { chromium } from 'playwright-core';
const e=new LightningEvent(195);
const p={x:195,y:780,width:40,height:50};
assert.equal(e.intersects(p,p,0,390,844),false);
e.update(90);assert.equal(e.striking,true);
assert.equal(e.geometry(390,844).bottom,844);
assert.equal(e.intersects(p,p,0,390,844),true);
assert.equal(e.intersects({...p,x:100},{...p,x:300},0,390,844),true);
assert.equal(e.intersects({...p,x:100},{...p,x:100},0,390,844),false);
assert.equal(e.intersects({...p,y:-220},{...p,y:-220},-1000,390,844),true);
e.hit=true;assert.equal(e.intersects(p,p,0,390,844),false);
e.update(12);assert.equal(e.striking,false);
e.update(30);assert.equal(e.dead,true);
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:8767');
 await page.evaluate(async()=>{
   const {LightningEvent}=await import('/js/lightning.js');
   const img=new Image();img.src='/assets/cloud-thunder-cycle-sheet.png';await img.decode();
   document.body.innerHTML='<canvas width="390" height="844"></canvas>';
   document.body.style.cssText='margin:0;display:block;background:#182a48';
   const c=document.querySelector('canvas'),ctx=c.getContext('2d');
   const event=new LightningEvent(195);event.update(94);
   ctx.fillStyle='#182a48';ctx.fillRect(0,0,390,844);event.draw(ctx,390,844);
 });
 await page.screenshot({path:'/tmp/poing-long-lightning.png'});
 console.log('PASS: warning, full-height strike, swept crossing, camera offset, one hit, fade/cleanup.');
} finally {await browser.close();}
