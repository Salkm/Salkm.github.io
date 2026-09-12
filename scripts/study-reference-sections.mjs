import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output='artifacts/reference-sections';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try {
  for(const [name,width,height] of [['wide',1900,1000],['desktop',1440,1000],['mobile',390,844]]) {
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('https://www.rubenmarcus.dev/',{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(5000);
    for(const [section,selector] of [['hire','.hire'],['proof','.stats'],['stack','.stack-section'],['writing','#writing'],['faq','#faq'],['contact','#contact-cta']]) {
      await page.locator(selector).evaluate(element=>window.scrollTo({top:element.getBoundingClientRect().top+scrollY-140,behavior:'instant'}));
      await page.waitForTimeout(1200);
      await page.screenshot({path:`${output}/${name}-${section}.png`,timeout:60000});
      const data=await page.locator(selector).evaluate(root=>{
        const nodes=[root,...root.querySelectorAll('header, h2, h3, p, article, ul, li, a, button, div')];
        return nodes.map(element=>{
          const style=getComputedStyle(element),r=element.getBoundingClientRect();
          return {tag:element.tagName,class:String(element.className),text:element.textContent.trim().slice(0,110),rect:{x:r.x,y:r.y+scrollY,width:r.width,height:r.height},font:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,padding:style.padding,gap:style.gap,grid:style.gridTemplateColumns,border:style.border,borderRadius:style.borderRadius,background:style.backgroundColor,color:style.color};
        });
      });
      reports.push({name,width,height,section,data,errors});
    }
    await page.close();
    console.log(`${name}: section study complete`);
  }
} finally {
  await writeFile(`${output}/measurements.json`,JSON.stringify(reports,null,2));
  await browser.close();
}
