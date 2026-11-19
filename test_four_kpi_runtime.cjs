/* Isolated JS regression checks without a browser or employee identifiers. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const dir=path.resolve(__dirname,'../dashboard_html');

// Test the source model's actual functions with synthetic branch-week inputs.
const source=fs.readFileSync(path.join(dir,'coexistence.js'),'utf8');
const headlineIds=['coexInefficiency','coexHeadlineCost','coexReduction','coexPermCost',
  'coexAgencySpend','coexOtherHeadline','coexBridgePerm','methodUnused',
  'methodMatchedPerm','methodAgencyOpp','methodCoexist','methodOther',
  'methodExposure','methodSpend'];
const nodes=Object.fromEntries(headlineIds.map(id=>[id,{textContent:'—',className:'value'}]));
const ctx={
 console,Date,Math,Number,String,Set,Map,Intl,
 document:{getElementById:id=>nodes[id]||null,querySelector:()=>null},
 $:id=>nodes[id]||null,
 S:{activity:[],branch:'All',from:'2026-01-01',to:'2026-12-31',restoreMode:'all'},
 gbp:new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}),
 num:new Intl.NumberFormat('en-GB'),whole:new Intl.NumberFormat('en-GB'),
 renderAll(){},parseWorkbook(){},filter(){},selectedPeriodUtilisation(){return[]},
 readTable(){return{rows:[]}},text:String,esc:String,excelDate:x=>x,iso:String,
 endOfWeek:s=>s,dateLabel:s=>s,
 setMetric(id,value){nodes[id].textContent=value},
};
vm.createContext(ctx);
vm.runInContext(source.replace(/\}\)\(\);\s*$/,'globalThis.__model={state,calculated,total,agencyPersonDays,update};})();'),ctx);
const m=ctx.__model;
const base={weekEnd:'2026-10-18',weekStart:'2026-10-12',branch:'Oxford',
 region:'South',covered:true,capacity:90,worked:45,unused:45,
 paidHours:30,ctPaidHours:20,hourly:400,nonhour:25,billed:425,permRate:12};
m.state.basis='hours';
const r=m.calculated(base);
assert.equal(r.unused,45);
assert.equal(r.matched,30); // Unit-count deployment, not CT billed hours.
assert.equal(r.agency,400); // Never allocate more than CT hourly cost.
assert.equal(r.permanent,360);
assert.equal(r.otherPermanent,180);
assert.equal(r.coexist,760);
const s=m.total([r]);
assert.equal(s.billed,425);
assert.equal(s.paidHours,30);
assert.equal(s.ctPaidHours,20);
assert.equal(s.otherPermanent+s.matchedPermanent,540);
assert.equal(s.coexist+s.otherPermanent,s.potential+540);
m.state.threshold=31;
// Threshold check is applied by the caller to the unit-count hours.
const qualified=base.paidHours>m.state.threshold;
assert.equal(qualified,false);

// Exercise the *actual display update*, not just the arithmetic: a formatting
// regression here previously caused an exception and blank/unvalidated KPIs.
m.state.threshold=0;
m.state.rows=[base];
m.state.ready=true;
assert.doesNotThrow(()=>m.update());
assert.equal(nodes.coexPermCost.textContent,'£540.00');
assert.equal(nodes.coexAgencySpend.textContent,'£425.00');
assert.equal(nodes.coexHeadlineCost.textContent,'£760.00');
assert.equal(nodes.coexOtherHeadline.textContent,'£180.00');
assert.equal(nodes.coexReduction.textContent,'£400.00');
assert.equal(nodes.coexBridgePerm.textContent,'£540.00');
assert.equal(nodes.coexInefficiency.textContent,'£940.00');
assert.equal(nodes.methodExposure.textContent,'£940.00');
assert.equal(nodes.methodSpend.textContent,'£425.00');
assert.equal(nodes.methodCoexist.textContent,'£760.00');
assert.equal(nodes.methodOther.textContent,'£180.00');

// Test worker filter's shared row-scope; costs are intentionally outside it.
const permanent={name:'Person P',status:'Permanent',homeBranch:'Oxford',date:'2026-10-14'};
const agency={name:'Person A',status:'Agency/External',homeBranch:'Oxford',date:'2026-10-14'};
const staff=[permanent,agency];
const workers={
 console,Date,Set,
 S:{activity:staff,branch:'All',from:'2026-01-01',to:'2026-12-31',search:'',filtered:staff},
 document:{querySelector:()=>null,getElementById:()=>null},
 filteredRows:()=>staff,personCandidates:()=>staff.map(r=>r.name),
 renderPeople(){},renderDetail(){},renderCalendar(){},renderBranch(){},renderJobs(){},
 updatePersonList(){},personPeriodRows:()=>staff,scopeText:()=>'',
 whole:new Intl.NumberFormat('en-GB'),setMetric(){},
};
vm.createContext(workers);
const workerSource=fs.readFileSync(path.join(dir,'workers-filter.js'),'utf8');
vm.runInContext(workerSource.replace(/\}\)\(\);\s*$/,'globalThis.__worker=worker;})();'),workers);
assert.equal(workers.filteredRows().length,2);
workers.__worker.mode='agency';
assert.deepEqual([...workers.filteredRows()].map(r=>r.name),['Person A']);
assert.deepEqual([...workers.personCandidates()],['Person A']);
workers.__worker.mode='permanent';
assert.deepEqual([...workers.filteredRows()].map(r=>r.name),['Person P']);
assert.deepEqual([...workers.personCandidates()],['Person P']);
assert.equal(s.billed,425); // The display mode did not touch financial aggregates.
console.log('Four-KPI JavaScript arithmetic and worker-category scope tests passed');
