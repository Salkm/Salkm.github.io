import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
await mkdir('artifacts/portrait-study',{recursive:true});
try {
  for(const [name,url,kind,options={}] of [
    ['default-personalized','http://127.0.0.1:4175/','owned'],
    ['explicit-reference-study','http://127.0.0.1:4175/?calibration=reference','reference'],
    ['owned-study','http://127.0.0.1:4175/?calibration=owned','owned'],
    ['character-alternate','http://127.0.0.1:4175/?renderer=character','character'],
    ['production-default','http://127.0.0.1:4176/','owned'],
    ['production-reference-ignored','http://127.0.0.1:4176/?calibration=reference','owned'],
    ['reference-retina','http://127.0.0.1:4175/?calibration=reference','reference',{deviceScaleFactor:2}],
    ['production-mobile-retina','http://127.0.0.1:4176/','owned',{viewport:{width:390,height:844},deviceScaleFactor:3}],
  ]) {
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options});
    const requests=[],errors=[];
    page.on('request',request=>requests.push(request.url()));
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__portfolioScene?.getDiagnostics().ready);
    const state=await page.evaluate(()=>window.__portfolioScene.getDiagnostics());
    assert.equal(state.paused,true);
    if(kind==='character') assert.equal(state.skeletal,true);
    else {
      assert.equal(state.representation,'image-video-webgl');
      assert.equal(state.motionSource,'image');
      assert.equal(state.source,kind==='reference'?'/__reference-study/portrait.png':'/portrait-fallback.png');
      assert.equal(requests.some(url=>url.includes('motion.mp4') || url.includes('portrait-typing.mp4')),false,'Reduced motion must not load the video');
      if(kind==='owned') assert.equal(state.videoSource,'/portrait-typing.mp4');
      if(kind==='owned') assert.equal(requests.some(url=>url.includes('/__reference-study/')),false);
      const rendered=await page.locator('#hero-canvas').evaluate(canvas=>{
        const gl=canvas.getContext('webgl2');
        const data=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
        let visible=0;
        for(let i=0;i<data.length;i+=16) if(data[i+3]>20 && data[i+1]>20) visible++;
        return {width:canvas.width,height:canvas.height,visible};
      });
      assert.equal(rendered.width,Math.floor(state.size.width*state.size.pixelRatio));
      assert.equal(rendered.height,Math.floor(state.size.height*state.size.pixelRatio));
      assert.ok(rendered.visible>1000,`${name}: visible portrait pixels`);
    }
    if(kind==='reference' || (kind==='owned' && !options.viewport)) {
      if(kind==='reference') assert.match(await page.locator('#hero-canvas').getAttribute('aria-label'),/Reference portrait/);
      await page.evaluate(()=>{
        window.__portfolioScene.setReducedMotion(false);
        window.__portfolioScene.setPaused(false);
      });
      await page.waitForFunction(()=>window.__portfolioScene.getDiagnostics().videoStatus==='ready');
      assert.equal(await page.evaluate(()=>window.__portfolioScene.getDiagnostics().motionSource),'video');
      await page.evaluate(()=>window.__portfolioScene.setReducedMotion(true));
      assert.equal(await page.evaluate(()=>window.__portfolioScene.getDiagnostics().motionSource),'image');
      assert.equal(await page.evaluate(()=>window.__portfolioScene.getDiagnostics().videoPaused),true);
    }
    assert.equal(await page.locator('.project').count(),6);
    assert.equal(errors.length,0,errors.join('; '));
    results.push({name,state,errors});
    console.log(`${name}: passed`);
    await page.close();
  }
  const fallback=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const fallbackErrors=[];
  fallback.on('pageerror',error=>fallbackErrors.push(error.message));
  await fallback.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args) {
      if(type==='webgl' || type==='webgl2' || type==='experimental-webgl') return null;
      return getContext.call(this,type,...args);
    };
  });
  await fallback.goto('http://127.0.0.1:4176/',{waitUntil:'networkidle'});
  await fallback.waitForFunction(()=>document.querySelector('.hero').dataset.scene==='fallback');
  assert.equal(await fallback.locator('.scene-fallback').isVisible(),true);
  assert.equal(await fallback.locator('.scene-fallback img').evaluate(image=>image.complete && image.naturalWidth>0),true);
  assert.equal(await fallback.locator('.scene-toolbar').isVisible(),false);
  assert.equal(await fallback.locator('.project').count(),6);
  assert.equal(fallbackErrors.length,0,fallbackErrors.join('; '));
  await fallback.screenshot({path:'artifacts/portrait-study/production-fallback.png'});
  results.push({name:'production-no-webgl',imageFallback:true,errors:fallbackErrors});
  console.log('Production portrait fallback: passed');
  await fallback.close();
} finally {
  await writeFile('artifacts/entrypoints.json',JSON.stringify(results,null,2));
  await browser.close();
}
