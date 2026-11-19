'use strict';
// Chrome integration acceptance against the exact attached Four KPIs v3 workbook.
const { chromium }=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  page.setDefaultTimeout(120000);
  page.on('pageerror',err=>{console.error('BROWSER JS ERROR:',err.message)});
  await page.goto('about:blank');
  await page.setContent('<div id="spfx-host"></div>');
  await page.addScriptTag({path:path.join(root,'node_modules/xlsx/dist/xlsx.full.min.js')});
  const markup=fs.readFileSync(path.join(root,'src/webparts/coexistenceDashboard/dashboardMarkup.ts'),'utf8');
  const body=JSON.parse(markup.match(/export const DASHBOARD_BODY:string=(.+);/)[1]);
  const css=JSON.parse(markup.match(/export const DASHBOARD_CSS:string=(.+);/)[1]);
  let code=fs.readFileSync(path.join(root,'src/webparts/coexistenceDashboard/dashboardRuntime.js'),'utf8')
    .replace(/^import \* as XLSX from 'xlsx';/,'')
    .replace('export function initializeDashboard','function initializeDashboard');
  code+='\nwindow.initializeDashboard=initializeDashboard;\n';
  await page.addScriptTag({content:code});
  const binary=fs.readFileSync(path.join(repo,'coexistence-data.xlsx')).toString('base64');
  await page.evaluate(({body,css,binary})=>{
   const host=document.getElementById('spfx-host'),shadow=host.attachShadow({mode:'open'});
   const style=document.createElement('style');style.textContent=css;shadow.append(style);
   const view=document.createElement('div');view.className='hg-coex-view';view.innerHTML=body;shadow.append(view);
   const data=Uint8Array.from(atob(binary),c=>c.charCodeAt(0));
   window.initializeDashboard(data.buffer,shadow);
  },{body,css,binary});
  const get=()=>page.evaluate(()=>{
   const r=document.getElementById('spfx-host').shadowRoot,$=id=>r.getElementById(id);
   return{
    status:$('status')?.textContent,
    errors:$('error')?.textContent,
    branches:[...$('pills').querySelectorAll('button')].map(x=>x.textContent.trim()),
    peopleNames:$('peActive')?.textContent,
    peopleRows:$('peopleRows')?.querySelectorAll('tr').length,
    personOptions:$('person')?.options.length,
    jobs:$('joJobs')?.textContent,
    customers:$('joCustomers')?.textContent,
    jobRows:$('jobRows')?.querySelectorAll('tr').length,
    branchRows:$('executiveRows')?.querySelectorAll('tr').length,
    trendSVG:Boolean($('weeklyTrendChart')?.querySelector('svg')),
    branchSVG:Boolean($('opportunityMatrix')?.querySelector('svg')),
    basis:$('coexBasis')?.value,
    four:['coexPermCost','coexAgencySpend','coexHeadlineCost','coexOtherHeadline'].map(id=>$(id)?.textContent),
    exposure:$('coexInefficiency')?.textContent
   };
  });
  const n=txt=>Number(String(txt||'').replace(/[£,]/g,''));
  const baseline=await get();console.log('Initial dashboard validation:',JSON.stringify(baseline));
  assert.equal(baseline.branches.length,10,'All + nine branch controls required');
  assert(baseline.branches.includes('Thurrock'),'Expected real branch absent');
  assert(n(baseline.peopleNames)>0,'People aggregation blank');
  assert(baseline.personOptions>0,'Individual employee selector empty');
  assert(n(baseline.jobs)>0,'Jobs source records blank');
  assert(n(baseline.customers)>0,'Customer source records blank');
  assert(baseline.branchRows>=9,'Branch detail table blank');
  assert(baseline.trendSVG&&baseline.branchSVG,'Costed-week charts blank');
  assert(Math.abs(n(baseline.exposure)-946345.32)<0.03,'The default financial total differs from the source V3 reference');
  assert(Math.abs(n(baseline.four[0])-466343.70)<1,'Default unused capacity differs');
  assert(Math.abs(n(baseline.four[1])-1358850.5)<1,'Default CT billed expenditure differs');
  assert(Math.abs(n(baseline.four[2])-704298.43)<1,'Default coexistence cost differs');
  await page.evaluate(()=>{const r=document.getElementById('spfx-host').shadowRoot;const basis=r.getElementById('coexBasis');basis.value='hours';basis.dispatchEvent(new Event('change',{bubbles:true}));});
  const actual=await get();console.log('Recorded actual hours selection:',JSON.stringify({basis:actual.basis,four:actual.four,exposure:actual.exposure}));
  assert(Math.abs(n(actual.exposure)-1005326.42)<0.03,'Recorded-hours financial total differs from V3 reference');
  await page.evaluate(()=>{const r=document.getElementById('spfx-host').shadowRoot;[...r.getElementById('pills').querySelectorAll('button')].find(b=>b.textContent.trim()==='Thurrock').click()});
  const branch=await get();assert.notEqual(branch.exposure,actual.exposure,'Branch choice did not recalculate financials');
  assert(branch.branchSVG,'Branch cost chart missing');
  await page.evaluate(()=>{const r=document.getElementById('spfx-host').shadowRoot;[...r.getElementById('pills').querySelectorAll('button')].find(b=>b.textContent.trim()==='All').click()});
  for(const tab of ['branch','people','individual','jobs','methodology']){
   await page.evaluate(tab=>{const r=document.getElementById('spfx-host').shadowRoot;r.querySelector('.tab[data-tab="'+tab+'"]').click()},tab);
   const isVisible=await page.evaluate(tab=>{const r=document.getElementById('spfx-host').shadowRoot;return r.getElementById('view-'+tab).classList.contains('active')},tab);
   assert(isVisible,'Tab did not activate: '+tab);
  }
  const dayParts=await page.evaluate(()=>{const r=document.getElementById('spfx-host').shadowRoot;return{calendar:r.getElementById('calendar').querySelectorAll('.day').length,activity:r.getElementById('individualPeriodRows').querySelectorAll('tr').length}});
  assert(dayParts.calendar>0,'Individual calendar is blank');
  console.log('SPFx v3 source parity browser checks PASSED');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
