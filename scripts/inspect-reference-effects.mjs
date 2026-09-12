import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('https://www.rubenmarcus.dev/',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForTimeout(5000);
  await page.waitForSelector('.hero-scan canvas',{timeout:60000});
  const result = await page.evaluate(()=>{
    const image = document.querySelector('img[src*="ruben-hero"]');
    const root = image.closest('section');
    const properties = ['position','top','left','width','height','opacity','maskImage','backgroundImage','transform','filter','mixBlendMode'];
    return [root,...root.querySelectorAll('*')].map(element=>{
      const style=getComputedStyle(element);
      const pseudos=['::before','::after'].map(pseudo=>{
        const style=getComputedStyle(element,pseudo);
        return {pseudo,content:style.content,...Object.fromEntries(properties.map(key=>[key,style[key]]))};
      }).filter(style=>!['none','normal'].includes(style.content));
      return {tag:element.tagName,class:element.className,...Object.fromEntries(properties.map(key=>[key,style[key]])),pseudos};
    });
  });
  await writeFile('artifacts/reference-synchronized/effects.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result.filter(item=>item.tag==='CANVAS'||item.tag==='IMG'||item.maskImage!=='none'||item.backgroundImage!=='none'||item.pseudos.length),null,2));
} finally {await browser.close();}
