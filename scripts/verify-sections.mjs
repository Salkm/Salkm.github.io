import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output='artifacts/section-study';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
  for(const [name,width,height] of process.env.MOTION_ONLY ? [] : [['wide',1900,1000],['desktop',1440,1000],['mobile',390,844],['compact',320,640],['tablet',768,1024]]) {
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4175/?renderer=portrait&calibration=reference',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__portfolioScene?.getDiagnostics().ready);
    const measurements=[];
    for(const [section,selector] of [['hire','#services'],['proof','#impact'],['stack','#skills'],['work','#work'],['about','#about'],['experience','#experience'],['contact','#contact']]) {
      await page.locator(selector).evaluate(element=>window.scrollTo({top:element.getBoundingClientRect().top+scrollY-140,behavior:'instant'}));
      await page.waitForTimeout(150);
      await page.screenshot({path:`${output}/${name}-${section}.png`,timeout:60000});
      const measured=await page.locator(selector).evaluate(root=>{
        const r=root.getBoundingClientRect();
        const wrap=root.querySelector('.wrap').getBoundingClientRect();
        const overflow=[...root.querySelectorAll('h2,h3,p,li,strong,button,a')].filter(element=>!element.closest('.sr-only') && element.scrollWidth>element.clientWidth+2 && getComputedStyle(element).display!=='inline').map(element=>({tag:element.tagName,class:element.className,text:element.textContent.trim().slice(0,80),scroll:element.scrollWidth,width:element.clientWidth}));
        return {height:r.height,y:r.y+scrollY,wrap:{x:wrap.x,width:wrap.width},overflow};
      });
      measurements.push({section,...measured});
      assert.equal(measured.overflow.length,0,`${name}/${section}: ${JSON.stringify(measured.overflow)}`);
    }
    assert.equal(await page.locator('.service-card').count(),3);
    assert.equal(await page.locator('.impact-grid > div').count(),8);
    for(const [filter,count] of [['automation',3],['security',2],['ai',1]]) {
      await page.locator(`[data-service-filter="${filter}"]`).click();
      await page.waitForFunction(()=>location.hash==='#work');
      assert.equal(await page.locator('.project').count(),count);
      assert.equal(await page.locator(`[data-filter="${filter}"]`).getAttribute('aria-pressed'),'true');
    }
    await page.locator('.project-open').click();
    assert.equal(await page.locator('.project-dialog').evaluate(dialog=>dialog.open),true);
    await page.keyboard.press('Escape');
    await page.locator('[data-filter="all"]').click();
    assert.equal(await page.locator('.project').count(),6);
    const canvas=await page.locator('#page-field').evaluate(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let count=0;
      for(let i=3;i<pixels.length;i+=4) if(pixels[i]>0) count++;
      return {count,width:canvas.width,height:canvas.height};
    });
    assert.ok(canvas.count>1000,'Dither field must contain visible pixels');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(errors.length,0,errors.join('; '));
    results.push({name,width,height,measurements,canvas,errors});
    console.log(`${name}: section layout, services, projects, and background checks passed`);
    await page.close();
  }
  const motion=await browser.newPage({viewport:{width:1024,height:800}});
  await motion.goto('http://127.0.0.1:4175/?renderer=portrait',{waitUntil:'networkidle'});
  await motion.waitForFunction(()=>window.__portfolioScene?.getDiagnostics().ready);
  const fieldHash=()=>motion.locator('#page-field').evaluate(canvas=>{
    const p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let hash=0;for(let i=3;i<p.length;i+=4)hash=((hash*31)^p[i])|0;
    return hash;
  });
  const initial=await fieldHash();
  await motion.locator('#skills').evaluate(element=>element.scrollIntoView({behavior:'instant'}));
  await motion.waitForTimeout(250);
  assert.equal(await fieldHash(),initial,'Ordered dither remains fixed on scroll');
  await motion.locator('.scene-toggle').click();
  await motion.waitForTimeout(150);
  const frozen=await fieldHash();
  await motion.locator('#work').evaluate(element=>element.scrollIntoView({behavior:'instant'}));
  await motion.waitForTimeout(250);
  assert.equal(await fieldHash(),frozen,'Pause freezes the background field');
  assert.equal(await motion.locator('.service-card').first().evaluate(element=>getComputedStyle(element).opacity),'1','Pause leaves content readable');
  await motion.emulateMedia({reducedMotion:'reduce'});
  await motion.waitForTimeout(150);
  const reduced=await fieldHash();
  await motion.locator('#contact').evaluate(element=>element.scrollIntoView({behavior:'instant'}));
  await motion.waitForTimeout(150);
  assert.equal(await fieldHash(),reduced,'Reduced motion keeps the field static');
  results.push({name:'page-motion',fixedDither:true,pause:true,reducedMotion:true});
  await motion.close();
  console.log('Fixed dither, pause, and reduced motion: passed');
} finally {
  await writeFile(`${output}/${process.env.MOTION_ONLY ? 'motion' : 'verification'}.json`,JSON.stringify(results,null,2));
  await browser.close();
}
