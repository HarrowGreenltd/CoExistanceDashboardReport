'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {unzipSync}=require('fflate'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
const archive=unzipSync(fs.readFileSync(path.join(root,'sharepoint/solution/harrowgreen-coexistence-dashboard.sppkg')));
const name=Object.keys(archive).find(x=>/^ClientSideAssets\/.*\.js$/.test(x));assert(name,'No compiled SPFx browser asset');
const bundle=new TextDecoder().decode(archive[name]);
const source=fs.readFileSync(path.join(repo,'coexistence-data.xlsx'));
const office=require('./test-package-normalisation.cjs').officeRepack(source);
const amd='window.define=function(name,deps,factory){function Stub(){this.domElement=document.getElementById("host");this.context={spHttpClient:{get:async()=>({ok:true,arrayBuffer:async()=>window.__bytes})}};}window.__component=factory({BaseClientSideWebPart:Stub},{SPHttpClient:{configurations:{v1:{}}}});};';
function number(x){return Number(String(x||'').replace(/[^0-9.]/g,''))}
async function run(page,buffer,label){
 await page.setContent('<div id="host"></div>');await page.addScriptTag({content:amd});await page.addScriptTag({content:bundle});
 await page.evaluate(b=>{window.__bytes=Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer},Buffer.from(buffer).toString('base64'));
 await page.evaluate(()=>{const W=window.__component.default;window.__app=new W();window.__app.render()});
 await page.waitForFunction(()=>{const s=document.querySelector('.hg-coex-status')?.textContent||'';return s.includes('Validated SharePoint workbook')||s.includes('validation failed')},{timeout:120000});
 const data=await page.evaluate(()=>{const s=document.querySelector('.hg-coex-status')?.textContent||'',r=document.querySelector('.hg-coex-dashboard')?.shadowRoot,$=id=>r?.getElementById(id);return{status:s,branches:r?.querySelectorAll('#pills button')?.length,people:$('peActive')?.textContent,jobs:$('joJobs')?.textContent,exposure:$('coexInefficiency')?.textContent,trend:!!$('weeklyTrendChart')?.querySelector('svg'),calendar:($('person')?.options?.length||0)>0}});
 console.log(label,JSON.stringify(data));
 assert(data.status.startsWith('Validated SharePoint workbook'),label+' failed validation');
 assert.equal(data.branches,10);assert.equal(number(data.people),652);assert.equal(number(data.jobs),3445);
 assert.equal(number(data.exposure),946345.32);assert(data.trend&&data.calendar);
 await page.evaluate(()=>{const r=document.querySelector('.hg-coex-dashboard').shadowRoot,b=r.getElementById('coexBasis');b.value='hours';b.dispatchEvent(new Event('change',{bubbles:true}))});
 const hours=await page.evaluate(()=>document.querySelector('.hg-coex-dashboard').shadowRoot.getElementById('coexInefficiency').textContent);
 assert(Math.abs(number(hours)-1005326.42)<.03,'Actual hours calculation');
 await page.evaluate(()=>{const r=document.querySelector('.hg-coex-dashboard').shadowRoot;[...r.querySelectorAll('#pills button')].find(x=>x.textContent.trim()==='Thurrock').click()});
 const branch=await page.evaluate(()=>document.querySelector('.hg-coex-dashboard').shadowRoot.getElementById('coexInefficiency').textContent);
 assert.notEqual(branch,hours,'Branch selection changed nothing');
 console.log(label+' COMPILED PACKAGE browser tests PASSED');
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const [label,b] of [['Reference',source],['Office-repacked',office]]){const p=await browser.newPage();p.setDefaultTimeout(120000);p.on('pageerror',e=>console.log('JS ERROR:',e.message));await run(p,b,label);await p.close()}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});