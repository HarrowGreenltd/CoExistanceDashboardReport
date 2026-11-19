/* Harrow Green – Coexistence cost model V3. Based on controlled workbook branch-week rows.
   Financial model is strictly at complete branch-week grain. Costs are scenario proxies,
   and hourly overlap is not verified operational substitutability. */
(function(){
'use strict';
const state={ready:false,rows:[],threshold:0,basis:'days',dayHours:new Map(),staff:null,error:''};
const toNum=v=>Number.isFinite(Number(v))?Number(v):0;
const currency=v=>gbp.format(Math.round((v+1e-7)*100)/100);
const moneyExact=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2});
const zero={qualified:0,covered:0,missing:0,capacity:0,worked:0,unused:0,matchedHours:0,otherHours:0,
  potential:0,structural:0,adjustments:0,billed:0,matchedPermanent:0,otherPermanent:0,coexist:0,paidHours:0,ctPaidHours:0};
const required=['Week ending','Week starting','Branch','Indicative region','Net contracted hours','Matched permanent worked hours',
  'Unused permanent hours','Diary agency recorded hours','CT billed hourly agency units','CT hourly agency cost (£)',
  'CT non-hour/zero-unit cost (£)','CT total billed cost (£)','CT complete-week coverage','Legacy permanent hourly rate (£)'];
function el(id){return document.getElementById(id)}
function buildControls(){
 if(!el('coexHeadline')){
  const before=document.querySelector('#view-executive .kpis.insight-five');
  if(before){
   const section=document.createElement('section');section.id='coexHeadline';section.className='coex-headline';
   section.setAttribute('aria-label','Headline cost and reduction opportunity');
   section.innerHTML=`<div class="coex-financial-title"><h3>Where our labour costs sit</h3><span>Selected branch and CT-costed weeks</span></div>
    <div class="coex-financial-grid">
    <article class="panel coex-financial-card primary"><div class="coex-label-row"><span class="label">1. Unused permanent capacity</span><button class="coex-info" type="button" title="Estimated cost of permanent contracted hours not deployed on jobs, after approved absence. Includes both matched and other unused capacity." aria-label="About unused permanent capacity">i</button></div><div class="value" id="coexPermCost">—</div><p class="coex-card-volume" id="coexPermVolume">—</p><p class="note">Permanent hours paid for but not deployed.</p></article>
    <article class="panel coex-financial-card"><div class="coex-label-row"><span class="label">2. Total agency spend</span><button class="coex-info" type="button" title="All agency costs billed by CT for complete costed weeks. Recorded worker-days and deployment hours come from unit count, which is separately reconciled to CT." aria-label="About total agency spend">i</button></div><div class="value" id="coexAgencySpend">—</div><p class="coex-card-volume" id="coexAgencyVolume">—</p><p class="note">Total billed agency labour, including work with no overlap.</p></article>
    <article class="panel coex-financial-card opportunity"><div class="coex-label-row"><span class="label">3. Overlapping labour cost</span><button class="coex-info" type="button" title="Combined modelled cost of unused permanent hours plus associated agency expenditure in the same branch and week. This is not a confirmed saving." aria-label="About overlapping labour cost">i</button></div><div class="value" id="coexHeadlineCost">—</div><p class="coex-card-volume" id="coexCoexistVolume">—</p><p class="note">Spare permanent hours alongside agency use in the same week.</p></article>
    <article class="panel coex-financial-card"><div class="coex-label-row"><span class="label">4. Other unused permanent time</span><button class="coex-info" type="button" title="Permanent capacity that was not deployed and was not matched against agency activity in the same branch and week. It is a subset of card 1." aria-label="About other unused permanent time">i</button></div><div class="value" id="coexOtherHeadline">—</div><p class="coex-card-volume" id="coexOtherVolume">—</p><p class="note">Spare permanent hours without matched agency use.</p></article>
    </div>
    <div class="coex-bridge panel" aria-label="Labour cost exposure calculation">
     <div class="coex-bridge-heading"><div><h3>Total identified labour cost exposure</h3><p>What we pay for without full deployment, plus agency work matched to that spare capacity.</p></div><span class="modelled">Modelled exposure</span></div>
     <div class="coex-bridge-steps"><div class="coex-bridge-part"><span>Unused permanent capacity</span><strong id="coexBridgePerm">—</strong></div><span class="coex-bridge-symbol" aria-hidden="true">+</span><div class="coex-bridge-part"><span>Agency spend in overlap <small>Potential reduction</small></span><strong id="coexReduction">—</strong></div><span class="coex-bridge-symbol" aria-hidden="true">=</span><div class="coex-bridge-part coex-bridge-total"><span>Total cost exposure</span><strong id="coexInefficiency">—</strong></div></div>
     <p class="coex-bridge-check" id="coexBridgeCheck">Also reconciles to overlapping labour cost + other unused permanent time.</p>
    </div>
    <div class="coex-financial-foot"><span id="coexFinancialFoot">These are modelled costs, not confirmed cash savings.</span><button type="button" class="coex-method-link" id="coexGoMethodology">Assumptions &amp; Calculations</button></div>`;
   before.insertAdjacentElement('beforebegin',section);
   el('coexGoMethodology')?.addEventListener('click',()=>switchTab('methodology'));
   for(const id of ['exCoexist','exAvoidable']){const card=el(id)?.closest('.kpi');if(card)card.style.display='none';}
   before.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';
  }
 }
 if(!el('coexThreshold')){
  const grid=document.querySelector('.filter-grid');
  if(grid){const field=document.createElement('div');field.className='field coex-threshold-field';
   field.innerHTML='<label for="coexThreshold">Agency threshold, hours/week</label><input id="coexThreshold" class="input" type="number" min="0" step="1" value="0" title="Minimum unit-count agency hours in the same branch/week">';
   grid.appendChild(field);el('coexThreshold').addEventListener('change',e=>{
    const v=Number(e.target.value);if(!Number.isFinite(v)||v<0){e.target.value=state.threshold;return}
    state.threshold=v;renderAll();
   });}
 }
 if(!el('coexBasis')){
  const grid=document.querySelector('.filter-grid');
  if(grid){const field=document.createElement('div');field.className='field coex-basis-field';
   field.innerHTML='<label for="coexBasis">Utilisation calculation basis</label><select id="coexBasis" class="input" title="Change both deployment utilisation and the branch-week cost model"><option value="days">Deployed days × 9 hours</option><option value="hours">Recorded actual hours</option></select>';
   grid.appendChild(field);el('coexBasis').value=state.basis;
   el('coexBasis').addEventListener('change',e=>{state.basis=e.target.value==='hours'?'hours':'days';filter();});}
 }
 if(!el('coexPanels')){
  const destination=el('view-methodology');
  if(destination){const panel=document.createElement('section');panel.id='coexPanels';panel.className='coex-panels';
   panel.innerHTML=`<article class="panel coex-panel"><div class="coex-card-head"><h3>Agency cost allocation</h3><span>CT worked-week costs</span></div>
    <div class="coex-value" id="coexAgencyTotal">—</div><div class="coex-bar" id="coexAgencyBar"></div><div id="coexAgencyRows" class="coex-legend"></div>
    <p class="coex-caveat">Billed agency cost split by its modelled allocation. See Assumptions &amp; Calculations for the rules.</p></article>
    <article class="panel coex-panel"><div class="coex-card-head"><h3>Permanent underutilisation</h3><span>Hours priced at historical branch proxies</span></div>
    <div class="coex-value" id="coexUnusedTotal">—</div><div class="coex-bar" id="coexPermanentBar"></div><div id="coexPermanentRows" class="coex-legend"></div>
    <p class="coex-caveat">Matched and other unused costs together equal the permanent capacity total in card 1.</p></article>`;
   destination.appendChild(panel);}
 }
 if(!el('coexOtherCost')){
  const branchArea=el('view-branch')?.querySelector('.kpis');
  if(branchArea){const card=document.createElement('article');card.className='panel kpi';
   card.innerHTML='<span class="label">Other permanent underutilisation <span class="modelled">Proxy</span></span><div id="coexOtherCost" class="value">—</div><div id="coexOtherMeta" class="note">Unused hours outside matched agency overlap</div>';
   branchArea.appendChild(card);}
 }
 if(!el('coexReconciliation')){
  const after=el('coexPanels');
  if(after){const panel=document.createElement('section');panel.id='coexReconciliation';panel.className='panel coex-reconciliation';
   panel.innerHTML=`<div class="coex-reconcile-head"><div><h3>Agency deployment vs billed hours</h3><p id="coexReconcileMeta">Unit count is the deployment control; CT is the billing source.</p></div><button id="coexExportVariance" type="button" class="btn">Export all differences (CSV)</button></div>
   <div class="coex-reconcile-summary" id="coexReconcileSummary"></div>
   <div class="table-scroll"><table><thead><tr><th>Week ending</th><th>Branch</th><th>Unit count hours</th><th>CT billed hours</th><th>Difference</th><th>CT billed cost</th></tr></thead><tbody id="coexVarianceRows"></tbody></table></div>
   <p class="coex-caveat">A difference is a reconciliation exception, not proof of incorrect billing. Confirm against unit-count allocation and CT timesheets. Unit-count activity without CT hourly pricing cannot contribute a modelled agency cost saving.</p>`;
   after.insertAdjacentElement('afterend',panel);
   el('coexExportVariance').addEventListener('click',()=>{
    const rows=selection().filter(r=>r.covered);
    const lines=[['Week ending','Branch','Unit count agency hours','CT billed agency hours','Difference (unit count - CT)','CT billed spend GBP'],...rows.map(r=>[r.weekEnd,r.branch,r.paidHours,r.ctPaidHours,r.paidHours-r.ctPaidHours,r.billed])];
    const csv=lines.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='HG_agency_unitcount_vs_CT_reconciliation.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   });
  }
 }
}
buildControls();
const resetButton=el('reset');if(resetButton)resetButton.addEventListener('click',()=>{state.threshold=0;state.basis='days';if(el('coexThreshold'))el('coexThreshold').value='0';if(el('coexBasis'))el('coexBasis').value='days';filter()});

// Both methods use the same HR-evidenced capacity and ADP absence deductions.
// The day alternative replaces each eligible worked person/date with nine
// deployment hours, regardless of how many chargeable hours were recorded.
function buildStaffIndex(wb){
 const roster=readTable(wb,'Employment Months',['Employee Number','Employee','Home Branch','Fixed / Overheads','Inferred Active From','Inferred Active To']);
 const contracts=readTable(wb,'Contract Hours Weekly',['Employee ID','Home Branch']);
 const absence=readTable(wb,'ADP Approved Dates',['Date','Employee ID']);
 const idOf=x=>String(x??'').replace(/\D/g,'');
 const nameOf=x=>String(x??'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const fixed=new Set(),eligible=new Map(),names=new Map(),home=new Map(),leave=new Set();
 for(const r of roster.rows){const id=idOf(r['Employee Number']);if(!id)continue;
  if(text(r['Fixed / Overheads'])==='Fixed')fixed.add(id);
  const n=nameOf(r['Employee']);if(n){if(!names.has(n))names.set(n,new Set());names.get(n).add(id)}
  home.set(id,text(r['Home Branch']));
  const first=iso(excelDate(r['Inferred Active From'])),last=iso(excelDate(r['Inferred Active To']));
  if(first&&last){const spans=eligible.get(id)||[];spans.push([first,last]);eligible.set(id,spans)}
 }
 for(const r of contracts.rows){const id=idOf(r['Employee ID']);if(id&&text(r['Home Branch']))home.set(id,text(r['Home Branch']))}
 for(const r of absence.rows){const id=idOf(r['Employee ID']),d=iso(excelDate(r['Date']));if(id&&d)leave.add(`${id}|${d}`)}
 return {fixed,eligible,names,home,leave,idOf,nameOf};
}
function workedPersonDays(activity,start='',end='9999-12-31'){
 const staff=state.staff,byWeek=new Map(),byBranch=new Map(),hoursByWeek=new Map(),seen=new Set();
 if(!staff)return {byWeek,byBranch,hoursByWeek};
 for(const r of activity){if(r.date<start||r.date>end||r.type!=='worked'||r.status!=='Permanent')continue;
  let id=staff.idOf(r.employeeId);
  if(!id){const ids=staff.names.get(staff.nameOf(r.name));if(ids?.size===1)id=[...ids][0]}
  if(!staff.fixed.has(id)||!staff.eligible.get(id)?.some(([a,b])=>r.date>=a&&r.date<=b)||staff.leave.has(`${id}|${r.date}`))continue;
  const branch=staff.home.get(id);if(!branch)continue;
  const week=`${branch}|${endOfWeek(r.date)}`;
  hoursByWeek.set(week,(hoursByWeek.get(week)||0)+toNum(r.hours));
  if(!(toNum(r.hours)>0))continue;
  const key=`${id}|${r.date}`;if(seen.has(key))continue;seen.add(key);
  byWeek.set(week,(byWeek.get(week)||0)+1);
  byBranch.set(branch,(byBranch.get(branch)||0)+1);
 }
 return {byWeek,byBranch,hoursByWeek};
}
function loadModel(){
 const wb=S.workbook;if(!wb)throw Error('No controlled Excel workbook loaded');
 const x=readTable(wb,'Weekly Coexistence',required);
 if(!x.rows?.length)throw Error('Weekly Coexistence is missing from the controlled workbook');
 const threshold=wb.Sheets?.['Coexistence Model']?.B4?.v;
 if(threshold!==undefined&&threshold!==''&&Number.isFinite(Number(threshold))&&Number(threshold)>=0){state.threshold=Number(threshold);if(el('coexThreshold'))el('coexThreshold').value=state.threshold;}
 const rows=x.rows.map(r=>({
  weekEnd:iso(excelDate(r['Week ending'])),weekStart:iso(excelDate(r['Week starting'])),
  branch:text(r['Branch']),region:text(r['Indicative region']),
  capacity:toNum(r['Net contracted hours']),worked:toNum(r['Matched permanent worked hours']),
  unused:toNum(r['Unused permanent hours']),paidHours:toNum(r['Diary agency recorded hours']),ctPaidHours:toNum(r['CT billed hourly agency units']),
  hourly:toNum(r['CT hourly agency cost (£)']),nonhour:toNum(r['CT non-hour/zero-unit cost (£)']),
  billed:toNum(r['CT total billed cost (£)']),covered:toNum(r['CT complete-week coverage'])===1,
  permRate:toNum(r['Legacy permanent hourly rate (£)'])
 })).filter(r=>r.branch&&r.weekEnd);
 if(rows.length<360)throw Error('Weekly model contains fewer branch-week records than expected');
 for(const r of rows){
  if([r.capacity,r.worked,r.unused,r.paidHours,r.ctPaidHours,r.permRate].some(v=>v<0))throw Error('Negative capacity, hours or rate: '+r.branch+' '+r.weekEnd);
  if(Math.abs(r.unused-Math.max(0,r.capacity-r.worked))>0.05)throw Error('Unused hours do not reconcile: '+r.branch+' '+r.weekEnd);
  if(r.covered&&Math.abs(r.hourly+r.nonhour-r.billed)>0.03)throw Error('CT hourly/adjustment cost mismatch: '+r.branch+' '+r.weekEnd);
  if(r.covered&&r.ctPaidHours>0&&r.hourly<=0)throw Error('Missing agency hourly cost: '+r.branch+' '+r.weekEnd);
  if(r.covered&&r.unused>0&&r.permRate<=0)throw Error('Missing permanent cost proxy: '+r.branch+' '+r.weekEnd);
 }
 state.staff=buildStaffIndex(wb);
 const deployed=workedPersonDays(S.activity);
 for(const r of rows){
  const key=`${r.branch}|${r.weekEnd}`;
  if(Math.abs(r.worked-(deployed.hoursByWeek.get(key)||0))>.05)
   throw Error('Worked-hours source mismatch: '+r.branch+' '+r.weekEnd);
 }
 state.dayHours=new Map([...deployed.byWeek].map(([k,v])=>[k,v*9]));
 state.rows=rows;state.ready=true;state.error='';
}
const priorParse=parseWorkbook;
parseWorkbook=function(buffer,name){state.ready=false;state.staff=null;priorParse(buffer,name);
 try{loadModel();filter()}catch(e){state.ready=false;state.error=e.message||String(e);showError('Costed coexistence unavailable: '+state.error);console.error(e);filter()}
};
function selection(){const a=S.from||S.min,b=S.to||S.max;return state.rows.filter(r=>r.weekEnd>=a&&r.weekEnd<=b&&(S.branch==='All'||S.branch===r.branch));}
function calculated(r){
 const worked=state.basis==='days'?(state.dayHours.get(`${r.branch}|${r.weekEnd}`)||0):r.worked;
 const unused=Math.max(0,r.capacity-worked);
 const qualified=r.covered&&unused>0&&r.paidHours>state.threshold;
 const matched=qualified?Math.min(unused,r.paidHours):0;
 // Unit-count deployment is the authoritative volume. CT is an independent
 // billing source used to price that volume; never price overlap beyond the
 // agency hourly spend evidenced by CT for this branch-week.
 const agency=r.ctPaidHours>0?Math.min(r.hourly,matched*r.hourly/r.ctPaidHours):0;
 const remainingAgency=r.covered?r.hourly-agency:0;
 const permanent=matched*r.permRate;
 const otherHours=r.covered?Math.max(0,unused-matched):0;
 const otherPermanent=otherHours*r.permRate;
 return {...r,worked,unused,qualified,matched,agency,remainingAgency,permanent,otherHours,otherPermanent,coexist:agency+permanent};
}
// Keep the headline utilisation KPI on the same basis as coexistence.
const priorUtilisation=selectedPeriodUtilisation;
selectedPeriodUtilisation=function(activity,start,end){
 const rows=priorUtilisation(activity,start,end);
 if(state.basis!=='days'||!state.staff)return rows;
 const grouped=workedPersonDays(activity,start,end).byBranch;
 let totalWorked=0,totalCapacity=0;
 return rows.map(r=>{
  const worked=r.branch==='National'?totalWorked:9*(grouped.get(r.branch)||0);
  const cap=toNum(r.capacityHours);
  if(r.branch!=='National'){totalWorked+=worked;totalCapacity+=cap}
  const deployed=r.branch==='National'?totalWorked:worked;
  const capacity=r.branch==='National'?totalCapacity:cap;
  return {...r,deployedHours:deployed,deployedDays:deployed/9,util:capacity>0?deployed/capacity:null};
 });
};
function total(rows){return rows.reduce((a,r)=>{
 a.covered+=+r.covered;a.missing+=+(!r.covered);if(!r.covered)return a;
 a.qualified+=+r.qualified;
 a.capacity+=r.capacity;a.worked+=r.worked;a.unused+=r.unused;
 a.matchedHours+=r.matched;a.otherHours+=r.otherHours;
 a.potential+=r.agency;a.structural+=r.remainingAgency;a.adjustments+=r.nonhour;
 a.billed+=r.billed;a.matchedPermanent+=r.permanent;a.otherPermanent+=r.otherPermanent;
 a.coexist+=r.coexist;a.paidHours+=r.paidHours;a.ctPaidHours+=r.ctPaidHours;return a;
 },{...zero});}
function fmtHours(v){return `${num.format(v)} hrs`}
function agencyPersonDays(covered){
 const keys=new Set(covered.map(r=>`${r.branch}|${r.weekEnd}`)),people=new Set();
 for(const r of S.activity){if(r.status!=='Agency/External'||r.type!=='worked'||r.hours<=0)continue;
  const branchWeek=`${r.homeBranch}|${endOfWeek(r.date)}`;if(!keys.has(branchWeek))continue;
  people.add(`${r.homeBranch}|${r.name.toLowerCase()}|${r.date}`);
 }
 return people.size;
}
function badgeText(r){return !r.covered?'No CT data':r.missing?'Partial CT coverage':'CT-costed weeks'}
function renderBreakdown(target,totals,items){
 if(!el(target))return;
 const grand=items.reduce((s,x)=>s+x.value,0);
 el(target).innerHTML=items.map(x=>`<div class="coex-line"><span><i style="background:${x.color}"></i>${esc(x.label)}</span><strong>${currency(x.value)}</strong></div>`).join('');
 const bar=el(target==='coexAgencyRows'?'coexAgencyBar':'coexPermanentBar');
 if(bar)bar.innerHTML=items.map(x=>`<span style="background:${x.color};width:${grand>0?Math.max(0,100*x.value/grand):0}%" title="${esc(x.label)}: ${currency(x.value)}"></span>`).join('');
}
function chartWeekly(rows){
 const grouped=new Map();for(const r of rows){const g=grouped.get(r.weekEnd)||{weekEnd:r.weekEnd,agency:0,permanent:0,total:0};g.agency+=r.agency;g.permanent+=r.permanent;g.total+=r.coexist;grouped.set(r.weekEnd,g)}
 const items=[...grouped.values()].sort((a,b)=>a.weekEnd.localeCompare(b.weekEnd));
 if(!items.length)return '<div class="chart-empty">No CT worked-week evidence for these dates.</div>';
 const w=720,h=248,left=65,right=20,top=15,bottom=32,max=Math.max(1,...items.map(x=>x.total))*1.08,bw=(w-left-right)/items.length;
 let svg='';for(let i=0;i<items.length;i++){const x=left+i*bw+bw*.15,bar=bw*.7;
  const ph=items[i].permanent/max*(h-top-bottom),ah=items[i].agency/max*(h-top-bottom);
  svg+=`<rect x="${x}" y="${h-bottom-ph}" width="${bar}" height="${ph}" fill="#14879c"><title>${esc(items[i].weekEnd)} permanent proxy ${currency(items[i].permanent)}</title></rect>`;
  svg+=`<rect x="${x}" y="${h-bottom-ph-ah}" width="${bar}" height="${ah}" fill="#6bcfb0"><title>${esc(items[i].weekEnd)} agency cost ${currency(items[i].agency)}</title></rect>`;
 }
 for(const t of [0,.5,1]){const y=h-bottom-t*(h-top-bottom);svg+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="#e0e9e6"/><text x="${left-5}" y="${y+4}" fill="#5d6a6c" text-anchor="end" font-size="11">£${num.format(t*max/1000)}k</text>`}
 svg+=`<text x="${left}" y="${h-7}" fill="#5d6a6c" font-size="11">${esc(items[0].weekEnd)}</text><text x="${w-right}" y="${h-7}" text-anchor="end" fill="#5d6a6c" font-size="11">${esc(items.at(-1).weekEnd)}</text>`;
 return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Costed coexistence by week, matched permanent cost and agency overlap" style="width:100%;height:100%">${svg}</svg>`;
}
function chartBranches(rows){
 const m=new Map();for(const r of rows){m.set(r.branch,(m.get(r.branch)||0)+r.coexist)}
 const data=[...m].sort((a,b)=>b[1]-a[1]);if(!data.length)return '<div class="chart-empty">No CT-covered weeks.</div>';
 const w=720,h=285,left=120,right=75,max=Math.max(1,...data.map(x=>x[1]));
 return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Matched-hour coexistence by branch" style="width:100%;height:100%">${data.map(([name,v],i)=>{const y=12+i*29,width=(w-left-right)*v/max;return `<text x="${left-9}" y="${y+15}" text-anchor="end" font-size="12" fill="#505759">${esc(name)}</text><rect x="${left}" y="${y+2}" width="${width}" height="18" rx="4" fill="#14879c"><title>${esc(name)} ${currency(v)}</title></rect><text x="${Math.min(w-right+6,left+width+7)}" y="${y+15}" font-size="11" fill="#505759">£${num.format(v/1000)}k</text>`}).join('')}</svg>`;
}
function coverageNotes(rows){const valid=rows.filter(x=>x.covered),any=rows.length>0;
 return !valid.length?'No CT data':valid.length<rows.length?'Partial CT coverage':'Complete CT coverage';}
function update(){
 const root=el('view-executive');
 if(!state.ready){for(const id of ['exCoexist','exAvoidable','brCoexist','coexOtherCost','coexInefficiency','coexHeadlineCost','coexReduction','coexOtherHeadline','coexPermCost','coexAgencySpend'])if(el(id))setMetric(id,'Not validated');for(const id of ['coexBridgePerm','methodUnused','methodMatchedPerm','methodAgencyOpp','methodCoexist','methodOther','methodExposure','methodSpend'])if(el(id))el(id).textContent='Not validated';return;}
 const selected=selection(),covered=selected.filter(x=>x.covered).map(calculated),t=total(covered),internalOnly=S.restoreMode==='only';
 const noData=!covered.length,coverage=coverageNotes(selected),display=internalOnly?'n.a.':noData?'No CT data':null;
 const basisNote=state.basis==='days'?'Deployed person-days × 9 hours':'Recorded actual worked hours';
 const agencyDays=agencyPersonDays(covered);
 // Make the displayed bridge reconcile to the penny, even when its source
 // components were aggregated with fractional pennies across branch-weeks.
 const bridgePermanent=Math.round((t.matchedPermanent+t.otherPermanent)*100)/100;
 const bridgeAgency=Math.round(t.potential*100)/100;
 const bridgeTotal=Math.round((bridgePermanent+bridgeAgency)*100)/100;
 const setCost=(id,v)=>{if(el(id))setMetric(id,display||currency(v))};
 setCost('exCoexist',t.coexist);setCost('exAvoidable',t.potential);setCost('brCoexist',t.coexist);setCost('coexOtherCost',t.otherPermanent);
 if(el('coexInefficiency'))el('coexInefficiency').textContent=display||moneyExact(bridgeTotal);
 setCost('coexHeadlineCost',t.coexist);
 if(el('coexReduction'))el('coexReduction').textContent=display||moneyExact(bridgeAgency);
 setCost('coexOtherHeadline',t.otherPermanent);
 setCost('coexPermCost',t.matchedPermanent+t.otherPermanent);
 setCost('coexAgencySpend',t.billed);
 if(el('coexBridgePerm'))el('coexBridgePerm').textContent=display||moneyExact(bridgePermanent);
 const setVolume=(id,v)=>{if(el(id))el(id).textContent=display||v};
 const equivalence=h=>`${num.format(h)} hours · ${num.format(h/9)} nine-hour day equivalents`;
 setVolume('coexPermVolume',equivalence(t.unused));
 setVolume('coexAgencyVolume',`${whole.format(agencyDays)} agency worker-days · ${num.format(t.paidHours)} recorded hours`);
 setVolume('coexCoexistVolume',equivalence(t.matchedHours));
 setVolume('coexOtherVolume',equivalence(t.otherHours));
 if(el('coexBridgeCheck'))el('coexBridgeCheck').textContent=display||`Cross-check: ${currency(t.coexist)} overlapping labour cost + ${currency(t.otherPermanent)} other unused permanent time = ${currency(t.coexist+t.otherPermanent)}.`;
 const methodMoney={methodUnused:bridgePermanent,methodMatchedPerm:t.matchedPermanent,methodAgencyOpp:bridgeAgency,methodCoexist:t.coexist,methodOther:t.otherPermanent,methodExposure:bridgeTotal,methodSpend:t.billed};
 for(const [id,value] of Object.entries(methodMoney))if(el(id))el(id).textContent=display||moneyExact(value);
 if(el('methodScope'))el('methodScope').textContent=`${S.branch==='All'?'All branches':S.branch} · ${dateLabel(S.from||S.min)}–${dateLabel(S.to||S.max)} · ${basisNote}`;
 if(el('methodVariance'))el('methodVariance').textContent=display||`${num.format(t.paidHours)} deployed agency hours against ${num.format(t.ctPaidHours)} CT billed hours: ${num.format(t.paidHours-t.ctPaidHours)} hours net difference.`;
 if(el('coexReconciliation'))el('coexReconciliation').style.display=internalOnly?'none':'block';
 if(el('coexReconcileSummary'))el('coexReconcileSummary').innerHTML=`<span>Unit-count agency <strong>${num.format(t.paidHours)} hrs</strong></span><span>CT hourly billed <strong>${num.format(t.ctPaidHours)} hrs</strong></span><span>Net difference <strong>${num.format(t.paidHours-t.ctPaidHours)} hrs</strong></span><span>Recorded agency <strong>${whole.format(agencyDays)} worker-days</strong></span>`;
 const variances=covered.filter(r=>Math.abs(r.paidHours-r.ctPaidHours)>0.01).sort((a,b)=>Math.abs(b.paidHours-b.ctPaidHours)-Math.abs(a.paidHours-a.ctPaidHours));
 if(el('coexReconcileMeta'))el('coexReconcileMeta').textContent=`${whole.format(variances.length)} branch-weeks differ by over 0.01 hours. Showing the 25 largest differences; export contains all costed branch-weeks.`;
 if(el('coexVarianceRows'))el('coexVarianceRows').innerHTML=variances.length?variances.slice(0,25).map(r=>`<tr><td>${esc(r.weekEnd)}</td><td>${esc(r.branch)}</td><td class="num">${num.format(r.paidHours)}</td><td class="num">${num.format(r.ctPaidHours)}</td><td class="num">${num.format(r.paidHours-r.ctPaidHours)}</td><td class="num">${currency(r.billed)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No billed-hour differences above 0.01 hours.</td></tr>';
 if(el('coexFinancialFoot'))el('coexFinancialFoot').textContent=internalOnly?'Supplier cost cannot be assigned to an HG/RHG-only customer view.':noData?'No complete CT-costed work weeks in this selection.':'Modelled exposure, not confirmed cash savings. The headline cards overlap; the bridge shows the correct calculation.';
 const utilLabel=el('exUtil')?.closest('.kpi')?.querySelector('.label');
 if(utilLabel)utilLabel.textContent=state.basis==='days'?'Deployment-day utilisation':'Recorded-hours utilisation';
 const utilNote=el('exUtil')?.closest('.kpi')?.querySelector('.note');
 if(utilNote)utilNote.textContent=state.basis==='days'?'Qualifying person-days × 9 hours ÷ available contracted hours (after approved ADP leave)':'Actual fixed-person worked hours ÷ available contracted hours (after approved ADP leave)';
 const branchUtilLabel=el('brUtil')?.closest('.kpi')?.querySelector('.label');
 if(branchUtilLabel)branchUtilLabel.textContent=state.basis==='days'?'Deployment-day utilisation':'Recorded-hours utilisation';
 const hrAudit=el('hrAuditSummary')?.querySelectorAll('p')?.[1];
 const selectionRow=(S.viewCurrent||[]).find(r=>r.branch===(S.branch==='All'?'National':S.branch));
 if(hrAudit&&selectionRow)hrAudit.innerHTML=`<strong>${num.format(selectionRow.deployedHours||0)}</strong> ${state.basis==='days'?'estimated deployed hours (qualifying days × 9)':'recorded permanent worked hours'} / <strong>${num.format(selectionRow.capacityHours||0)}</strong> net available contracted hours in the selected period and customer view.`;
 if(el('coexOtherMeta'))el('coexOtherMeta').textContent=`${num.format(t.otherHours)} hrs not matched to agency · historical cost proxy`;
 // The five existing KPIs remain, led by matched coexistence.
 const coexist=el('exCoexist')?.closest('.kpi'),avoidable=el('exAvoidable')?.closest('.kpi');
 if(coexist){const parent=coexist.parentElement;if(parent.firstElementChild!==coexist)parent.insertBefore(coexist,parent.firstElementChild);
  coexist.querySelector('.label').innerHTML='Matched-hour coexistence <span class="modelled">Modelled</span>';
  coexist.querySelector('.note').textContent='Agency overlap + cost proxy for the SAME matched permanent hours; not a savings claim';}
 if(avoidable){avoidable.querySelector('.label').innerHTML='Potentially avoidable agency <span class="modelled">Modelled</span>';
  avoidable.querySelector('.note').textContent='CT agency hourly cost matched to unused permanent capacity, branch/week';}
 if(el('exCoexistDelta'))el('exCoexistDelta').textContent=internalOnly?'Agency CT cannot be attributed to internal customers':noData?'No CT worked weeks in selected period':`${whole.format(t.qualified)} coexistence branch-weeks · ${num.format(t.matchedHours)} matched hours · ${coverage}`;
 if(el('exAvoidableDelta'))el('exAvoidableDelta').textContent=internalOnly?'Not attributable to internal-only records':noData?'No CT cost evidence':`${currency(t.structural)} capacity-unmatched (provisionally structural)`;
 const panels=el('coexPanels');if(panels)panels.style.display=internalOnly?'none':'grid';
 if(el('coexAgencyTotal'))el('coexAgencyTotal').textContent=noData?'No CT data':currency(t.billed);
 if(el('coexUnusedTotal'))el('coexUnusedTotal').textContent=noData?'No CT data':`${num.format(t.unused)} unused hrs · ${currency(t.matchedPermanent+t.otherPermanent)}`;
 renderBreakdown('coexAgencyRows',t,[
  {label:'Potentially avoidable agency (matched)',value:t.potential,color:'#14879c'},
  {label:'Other billed agency hours (not matched)',value:t.structural,color:'#6bcfb0'},
  {label:'Non-hourly adjustments',value:t.adjustments,color:'#d7c1a3'}]);
 renderBreakdown('coexPermanentRows',t,[
  {label:`Matched coexistence: ${num.format(t.matchedHours)} hrs`,value:t.matchedPermanent,color:'#14879c'},
  {label:`Other underutilisation: ${num.format(t.otherHours)} hrs`,value:t.otherPermanent,color:'#c1d7cd'}]);
 const summary=$('view-executive')?.querySelector('.heading.first p');if(summary)summary.textContent=`${basisNote} compared with net contracted capacity. Financial overlap is matched at the branch/week level.`;
 const note=$('view-executive')?.querySelector('.action-note');if(note)note.textContent=`Matched cost is based on spare permanent capacity alongside agency deployment in the same branch/week. See Assumptions & Calculations for the detailed rules, source differences and limitations.`;
 const trends=el('weeklyTrendChart'),matrix=el('opportunityMatrix');
 if(trends)trends.innerHTML=internalOnly?'<div class="chart-empty">CT customer attribution is unavailable for HG/RHG-only activity.</div>':chartWeekly(covered);
 if(matrix)matrix.innerHTML=internalOnly?'<div class="chart-empty">CT customer attribution is unavailable for HG/RHG-only activity.</div>':chartBranches(covered);
 const trendCard=trends?.closest('.chart-card');if(trendCard){trendCard.querySelector('h3').textContent='Weekly matched-hour coexistence';trendCard.querySelector('.card-head p').textContent='Agency cost overlap and the permanent-hour cost proxy, by complete CT worked week.';
  const legend=trendCard.querySelector('.trend-legend');if(legend)legend.innerHTML='<span class="legend-key"><span class="legend-dot" style="background:#14879c"></span>Matched permanent proxy</span><span class="legend-key"><span class="legend-dot" style="background:#6bcfb0"></span>Agency overlap cost</span>';}
 const matrixCard=matrix?.closest('.chart-card');if(matrixCard){matrixCard.querySelector('h3').textContent='Coexistence by branch';matrixCard.querySelector('.card-head p').textContent='Strict matched-hour cost (agency overlap + same matched permanent hours).'}
 const groups=new Map();for(const r of covered){if(!groups.has(r.branch))groups.set(r.branch,[]);groups.get(r.branch).push(r)}
 const branchRows=[...groups].map(([branch,arr])=>({branch,region:arr[0].region,...total(arr),rows:arr}));
 const body=el('executiveRows'),table=body?.closest('table');
 const heads=['Branch','Hours utilisation','Net contracted hours','Unit-count agency hours','CT spend','Matched coexistence','Other unused perm. cost','Potential agency cost','Capacity-unmatched agency'];
 table?.querySelectorAll('thead th').forEach((th,i)=>th.textContent=heads[i]||th.textContent);
 if(body){
  if(internalOnly||noData)body.innerHTML=`<tr><td colspan="9" class="empty">${internalOnly?'CT agency costs cannot be allocated to an internal-customer-only filter.':'No CT worked-week data for the selected period.'}</td></tr>`;
  else{
   const util=new Map((S.viewCurrent||[]).map(r=>[r.branch,r]));const regions=new Map();
   for(const b of branchRows){const key=b.region||'Unconfirmed region';if(!regions.has(key))regions.set(key,[]);regions.get(key).push(b)}
   body.innerHTML=[...regions].sort(([a],[b])=>a.localeCompare(b)).map(([name,items])=>{
    return `<tr class="region-group"><td colspan="9"><strong>${esc(name)} (provisional)</strong> · ${currency(items.reduce((s,r)=>s+r.coexist,0))}</td></tr>`+
     items.sort((a,b)=>b.coexist-a.coexist).map(b=>{
      const u=util.get(b.branch);const pct=u?.util===null||u?.util===undefined?'n.a.':`${num.format(u.util*100)}%`;
      return `<tr><td class="primary-cell">${esc(b.branch)}</td><td class="num">${pct}</td><td class="num">${num.format(b.capacity)}</td><td class="num">${num.format(b.paidHours)}</td><td class="num">${currency(b.billed)}</td><td class="num">${currency(b.coexist)}</td><td class="num">${currency(b.otherPermanent)}</td><td class="num">${currency(b.potential)}</td><td class="num">${currency(b.structural)}</td></tr>`;
     }).join('')}).join('');
  }
 }
 const overlaps=el('overlapRows');overlaps?.closest('table')?.querySelectorAll('thead th').forEach((th,i)=>{const h=['Week ending','Branch','Unit-count agency hrs','Unused perm. hrs','Matched hrs','Potential agency cost','Matched coexistence'];th.textContent=h[i]||th.textContent});
 if(overlaps)overlaps.innerHTML=internalOnly?'<tr><td colspan="7" class="empty">Not attributable to an internal-only customer selection.</td></tr>':
  noData?'<tr><td colspan="7" class="empty">No CT cost data for this period.</td></tr>':
  covered.filter(r=>r.qualified).sort((a,b)=>b.coexist-a.coexist).slice(0,40).map(r=>`<tr><td>${esc(r.weekEnd)}</td><td>${esc(r.branch)}</td><td class="num">${num.format(r.paidHours)}</td><td class="num">${num.format(r.unused)}</td><td class="num">${num.format(r.matched)}</td><td class="num">${currency(r.agency)}</td><td class="num">${currency(r.coexist)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No coexistence at this agency-hour threshold.</td></tr>';
 if(el('overlapMeta'))el('overlapMeta').textContent=`${whole.format(t.qualified)} qualifying branch-weeks · ${coverage}`;
 if(el('freshFinance'))el('freshFinance').textContent=`CT cost to 18 Oct 2026 · ${state.basis==='days'?'9h deployment-day basis':'actual-hours basis'} · historic perm. proxy`;
 const branchIntro=el('view-branch')?.querySelector('.heading.first p');if(branchIntro)branchIntro.textContent='Drill into branch deployment, unused contracted hours and same-week agency usage.';
 const priority=overlaps?.closest('.table-card')?.querySelector('.action-note');if(priority)priority.textContent='Same-branch/week hourly overlap is an opportunity signal. Role, shift, competence and customer substitutability remain unverified.';
 const foot=document.querySelector('.footer');if(foot)foot.textContent=`Confidential employee/agency data: private hosting only. Active basis: ${basisNote}. Costs are matched-hour scenarios; potential agency cost is part of both coexistence and CT spend (do not add them together). Agency capacity-unmatched is provisionally structural, not proven necessary.`;
}
const earlierRenderAll=renderAll;
renderAll=function(){earlierRenderAll();update()};
})();
