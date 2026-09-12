import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
  for(const [name,url,selectors] of [
    ['reference','https://www.rubenmarcus.dev/',['.hire__title','.hire__desc','.section-header__title','.stats__title']],
    ['local','http://127.0.0.1:4175/',['#services-heading','.service-card p','#work-heading','#impact-heading']],
  ]) {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(1000);
    const session=await page.context().newCDPSession(page);
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const {root}=await session.send('DOM.getDocument');
    for(const selector of selectors) {
      const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
      const fonts=await session.send('CSS.getPlatformFontsForNode',{nodeId});
      const style=await page.locator(selector).first().evaluate(element=>{
        const s=getComputedStyle(element);
        return {font:s.fontFamily,weight:s.fontWeight,size:s.fontSize};
      });
      results.push({name,selector,...style,...fonts});
    }
    if(name==='reference') {
      const details=await page.evaluate(()=>[...document.querySelectorAll('.hire__card *, .stats__grid *')].filter(element=>[...element.childNodes].some(node=>node.nodeType===Node.TEXT_NODE && node.textContent.trim())).slice(0,40).map(element=>{
        const style=getComputedStyle(element);
        return {tag:element.tagName,class:element.className,text:element.textContent.trim().slice(0,40),font:style.fontFamily,size:style.fontSize,lineHeight:style.lineHeight,weight:style.fontWeight};
      }));
      results.push({name,details});
    }
    await page.close();
  }
  await writeFile('artifacts/reference-sections/actual-fonts.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
