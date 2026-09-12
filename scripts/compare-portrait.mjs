import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { PNG } = require(process.env.PNGJS_MODULE || 'pngjs');
const referenceDirectory=process.env.REFERENCE_OUTPUT || 'artifacts/reference-centered';
const reports=[];
for (const name of ['wide','desktop']) {
  const reference=PNG.sync.read(await readFile(`${referenceDirectory}/${name}-top.png`));
  const local=PNG.sync.read(await readFile(`artifacts/portrait-study/${name}.png`));
  const region={left:Math.round(reference.width*.835),right:reference.width-65,top:195,bottom:530};
  function correlation(dx,dy) {
    let n=0,a=0,b=0,aa=0,bb=0,ab=0;
    for(let y=region.top;y<region.bottom;y+=2) for(let x=region.left;x<region.right;x+=2) {
      const first=reference.data[(y*reference.width+x)*4+1];
      const second=local.data[((y+dy)*local.width+x+dx)*4+1];
      n++;a+=first;b+=second;aa+=first*first;bb+=second*second;ab+=first*second;
    }
    return (ab-a*b/n)/Math.sqrt((aa-a*a/n)*(bb-b*b/n));
  }
  let best={dx:0,dy:0,correlation:correlation(0,0)};
  const baseline=best.correlation;
  for(let dy=-12;dy<=12;dy++) for(let dx=-16;dx<=16;dx++) {
    const value=correlation(dx,dy);
    if(value>best.correlation) best={dx,dy,correlation:value};
  }
  const subjectRegion={left:Math.round(reference.width*.54),right:reference.width-65,top:180,bottom:900};
  let count=0,difference=0,a=0,b=0,aa=0,bb=0,ab=0;
  for(let y=subjectRegion.top;y<subjectRegion.bottom;y++) for(let x=subjectRegion.left;x<subjectRegion.right;x++) {
    const i=(y*reference.width+x)*4;
    const first=reference.data[i+1],second=local.data[i+1];
    if(Math.max(first,second)<25) continue;
    count++;a+=first;b+=second;aa+=first*first;bb+=second*second;ab+=first*second;
    for(let channel=0;channel<3;channel++)difference+=Math.abs(reference.data[i+channel]-local.data[i+channel]);
  }
  const subject={region:subjectRegion,selectedPixels:count,meanAbsoluteRgbError:difference/(count*3),correlation:(ab-a*b/count)/Math.sqrt((aa-a*a/count)*(bb-b*b/count))};
  reports.push({name,referenceDirectory,region,baseline,best,subject,note:'Fixed-frame image-region measurements with the cursor centered. Correlation is not a whole-site similarity percentage.'});
}
await writeFile('artifacts/portrait-study/frame-comparison.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
