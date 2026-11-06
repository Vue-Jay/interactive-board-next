/** A real Chromium measurement of the same React/Canvas skin viewport.
 * On CI it tests the animation at the user's ~4152% digital zoom and
 * records long requestAnimationFrame intervals. CI ≠ tablet FPS, but
 * unlike TypeScript checks this exercises actual drawing code.
 */
import {chromium} from "playwright";
import fs from "node:fs";
const origin="http://127.0.0.1:5173";
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
let measured;
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},
  deviceScaleFactor:1});
 await page.goto(origin+"/tests/anatomy-visual-preview.html?zoom=42",
  {waitUntil:"networkidle"});
 await page.locator('[data-testid="skin-visual-stage"] canvas').waitFor();
 await page.waitForTimeout(650);
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 measured=await page.evaluate(async()=>{
  const button=Array.from(document.querySelectorAll("button")).find(
   el=>el.textContent?.trim()==="36000%");
  if(!button)throw new Error("Deep zoom button missing");
  const samples=[];
  let previous=performance.now();
  // Animation begins while measuring, so each following RAF includes
  // the actual anatomy scene composition and canvas repaint workload.
  button.click();
  return new Promise(resolve=>{
   const begin=previous;
   function step(now){
    samples.push(Math.max(0,now-previous));previous=now;
    if(samples.length<100){requestAnimationFrame(step);return;}
    const ordered=samples.slice(5).sort((a,b)=>a-b);
    const at=(q)=>ordered[Math.min(ordered.length-1,
     Math.round((ordered.length-1)*q))];
    resolve({frames:samples.length,
     totalMs:Math.round(previous-begin),
     medianFrameMs:Math.round(at(.5)*10)/10,
     p95FrameMs:Math.round(at(.95)*10)/10,
     maxFrameMs:Math.round(at(1)*10)/10});
   }
   requestAnimationFrame(step);
  });
 });
 if(errors.length)throw Error("Browser JS errors: "+errors.join(" | "));
 // This is deliberately a permissive tripwire: slow shared CI runners
 // must not be confused with real tablet performance. Detailed numbers
 // are kept as evidence instead of inventing a mobile FPS claim.
 if(measured.p95FrameMs>140)throw Error(
  "Critical long frames during deep zoom: "+JSON.stringify(measured));
 fs.mkdirSync("artifacts/anatomy",{recursive:true});
 fs.writeFileSync("artifacts/anatomy/skin-deep-zoom-frame-times.json",
  JSON.stringify({source:"GitHub Actions headless Chromium, NOT real tablet",
   fromPercent:4200,toPercent:36000,...measured},null,2));
 console.log("CHROMIUM_SKIN_FRAME_TIMES",JSON.stringify(measured));
}finally{await browser.close();}
