import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
  for(const [width,height] of [[768,1024],[900,900],[901,900]]) {
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    await page.goto('https://www.rubenmarcus.dev/',{waitUntil:'domcontentloaded',timeout:90000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(3000);
    const details=await page.evaluate(()=>{
      const image=document.querySelector('img[src*="ruben-hero"]');
      return [image,image.parentElement,image.closest('section')].map(element=>{
        const r=element.getBoundingClientRect(),s=getComputedStyle(element);
        return {class:element.className,rect:{x:r.x,y:r.y,width:r.width,height:r.height},opacity:s.opacity,mask:s.maskImage,objectFit:s.objectFit,objectPosition:s.objectPosition,canvas:element.querySelectorAll('canvas').length};
      });
    });
    await page.screenshot({path:`artifacts/reference-sections/hero-${width}.png`,timeout:60000});
    results.push({width,height,details});
    await page.close();
  }
  await writeFile('artifacts/reference-sections/tablet-framing.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
