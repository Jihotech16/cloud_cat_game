import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin=process.env.REWARD_TEST_ORIGIN||'http://127.0.0.1:8767';
const version=process.env.REWARD_CARD_VERSION||'v3';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(`${origin}/resources/reward-cards/${version}/index.html`);
  const results=await page.evaluate(async(version)=>{
    const imgs=[...document.images];
    const rows=[];
    for(const el of imgs) {
      await el.decode();
      for(const scale of [1,2]) {
        const im=new Image();im.src=scale===1?el.src:el.src.replace(`/${version}/`,`/${version}/runtime/`);await im.decode();
        const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
        const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
        const d=ctx.getImageData(0,0,c.width,c.height).data;
        let l=c.width,t=c.height,r=-1,b=-1,clear=0;
        for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
          const a=d[(y*c.width+x)*4+3];if(a===0)clear++;
          if(a>=128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
        }
        rows.push({id:el.alt,scale,size:[c.width,c.height],bounds:[l,t,r-l+1,b-t+1],clear:clear/(c.width*c.height),corners:[3,(c.width-1)*4+3,((c.height-1)*c.width)*4+3,d.length-1].map(i=>d[i]),center:d[(Math.floor(c.height*.8)*c.width+Math.floor(c.width/2))*4+3]});
      }
    }
    return rows;
  },version);
  assert.equal(results.length,46);
  for(const r of results){
    const s=r.scale;
    assert.deepEqual(r.size,[512/s,768/s],r.id);
    assert.deepEqual(r.bounds,[16/s,24/s,480/s,720/s],r.id);
    assert.deepEqual(r.corners,[0,0,0,0],r.id);
    assert.ok(r.clear>.1,r.id+' transparency');
    assert.ok(r.center>=250,r.id+' opaque interior');
  }
  await page.screenshot({path:'/tmp/poing-reward-card-gallery.png',fullPage:true});
  console.log('PASS: all 23 cards, both sizes, identical visible bounds, transparent corners and opaque text panel.');
} finally {await browser.close();}
