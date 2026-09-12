import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto('https://www.rubenmarcus.dev/',{waitUntil:'domcontentloaded',timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(3000);
  const rules=await page.evaluate(()=>{
    const matched=[];
    function visit(rules,context='') {
      for(const rule of rules) {
        if(rule.selectorText && /\.stats__(grid|value|inner)|^\.container/.test(rule.selectorText)) matched.push({context,selector:rule.selectorText,style:rule.style.cssText});
        if(rule.cssRules) visit(rule.cssRules,`${context} ${rule.conditionText || ''}`.trim());
      }
    }
    for(const sheet of document.styleSheets) {try {visit(sheet.cssRules);} catch {}}
    return matched;
  });
  await writeFile('artifacts/reference-sections/metric-rules.json',JSON.stringify(rules,null,2));
  for(const width of [390,600,640,641,760,768,900,901,1024,1100,1101,1200,1440]) {
    await page.setViewportSize({width,height:844});
    const details=await page.evaluate(()=>{
      const value=document.querySelector('.stats__value');
      const label=document.querySelector('.stats__label');
      return [document.querySelector('.stats'),document.querySelector('.stats__grid'),value.parentElement,value,label].map(element=>{
        const s=getComputedStyle(element),r=element.getBoundingClientRect();
        return {class:element.className,width:r.width,height:r.height,padding:s.padding,gap:s.gap,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,grid:s.gridTemplateColumns};
      });
    });
    results.push({width,details});
  }
  await writeFile('artifacts/reference-sections/metric-spacing.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({width,details})=>({width,grid:details[1].grid,gridWidth:details[1].width,cellHeight:details[2].height})),null,2));
} finally {await browser.close();}
