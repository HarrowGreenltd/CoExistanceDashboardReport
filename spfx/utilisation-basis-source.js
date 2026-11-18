/* The approved seven-day measure is unchanged. Contract-hours is a selectable,
   separate operational estimate. Hours are never added to person-day agency demand. */
(function(){
  var basis='days',hoursById=new Map(),fixedById=new Map(),absence=new Set(),idByName=new Map(),modelReady=false;
  const id=v=>String(v===undefined||v===null?'':v).replace(/[^0-9]/g,'');
  const key=(a,b)=>a+'|'+b;
  function addName(name,employeeId){
    const n=normaliseName(name);if(!n)return;
    const list=idByName.get(n)||new Set();list.add(employeeId);idByName.set(n,list);
  }
  function hydrateContractModel(){
    hoursById=new Map();fixedById=new Map();absence=new Set();idByName=new Map();modelReady=false;
    const hr=readTable(S.workbook,'HR Register',['Employee ID','Weekly Hours (reference only)'],true);
    const months=readTable(S.workbook,'Employment Months',['Employee Number','Fixed / Overheads','Inferred Active From','Inferred Active To'],true);
    const approved=readTable(S.workbook,'ADP Approved Dates',['Date','Employee ID'],true);
    if(!hr||!months||!approved)throw Error('Contractual-hour view requires HR Register, Employment Months and ADP Approved Dates.');
    for(const r of hr.rows){
      const employeeId=id(r['Employee ID']),hours=Number(r['Weekly Hours (reference only)']);
      if(employeeId&&Number.isFinite(hours)&&hours>0&&hours<=80)hoursById.set(employeeId,hours);
      if(employeeId)addName(r['Employee'],employeeId);
    }
    for(const r of months.rows){
      if(text(r['Fixed / Overheads'])!=='Fixed')continue;
      const employeeId=id(r['Employee Number']),first=iso(excelDate(r['Inferred Active From'])),last=iso(excelDate(r['Inferred Active To']));
      if(!employeeId||!first||!last||first>last)continue;
      if(!fixedById.has(employeeId))fixedById.set(employeeId,{branch:text(r['Home Branch']),eligible:new Set()});
      const p=fixedById.get(employeeId);
      if(!p.branch)p.branch=text(r['Home Branch']);
      for(let d=first;d<=last;d=addDays(d,1))p.eligible.add(d);
      addName(r['Employee'],employeeId);
    }
    for(const r of approved.rows){const employeeId=id(r['Employee ID']),d=iso(excelDate(r['Date']));if(employeeId&&d)absence.add(key(employeeId,d));}
    modelReady=true;
  }
  function employeeIdFor(row){
    const found=id(row.employeeId);
    if(found&&fixedById.has(found))return found;
    const named=idByName.get(normaliseName(row.name));
    return named&&named.size===1?[...named][0]:'';
  }
  function selectHours(activity,start,end,personId){
    const byBranch=new Map(),persons=new Map(),unmapped=new Set(),rawByPersonWeek=new Map();
    for(const [employeeId,p] of fixedById){
      if(personId&&personId!==employeeId)continue;
      const weeklyHours=hoursById.get(employeeId);
      if(!weeklyHours){unmapped.add(employeeId);continue}
      const part={employeeId,branch:p.branch||'Unmapped',capacity:0,recorded:0,used:0,unused:0,overtime:0};
      persons.set(employeeId,part);
      for(const d of p.eligible){
        if(d<start||d>end||absence.has(key(employeeId,d)))continue;
        const week=startOfWeek(d);
        const k=key(employeeId,week);
        const group=rawByPersonWeek.get(k)||{id:employeeId,branch:part.branch,capacity:0,actual:0};
        group.capacity+=weeklyHours/7;
        rawByPersonWeek.set(k,group);
      }
    }
    for(const r of activity){
      if(r.date<start||r.date>end||r.type!=='worked'||r.status!=='Permanent')continue;
      const employeeId=employeeIdFor(r),person=persons.get(employeeId),fixed=fixedById.get(employeeId);
      if(!person||!fixed||!fixed.eligible.has(r.date)||absence.has(key(employeeId,r.date)))continue;
      const group=rawByPersonWeek.get(key(employeeId,startOfWeek(r.date)));
      if(group)group.actual+=Math.max(0,val(r.hours));
    }
    for(const group of rawByPersonWeek.values()){
      const p=persons.get(group.id),used=Math.min(group.actual,group.capacity);
      p.capacity+=group.capacity;p.recorded+=group.actual;p.used+=used;
      p.overtime+=Math.max(0,group.actual-group.capacity);
    }
    for(const person of persons.values()){
      person.unused=Math.max(0,person.capacity-person.used);
      const b=byBranch.get(person.branch)||{branch:person.branch,capacity:0,used:0,recorded:0,unused:0,overtime:0};
      for(const field of ['capacity','used','recorded','unused','overtime'])b[field]+=person[field];
      byBranch.set(person.branch,b);
    }
    const national={branch:'National',capacity:0,used:0,recorded:0,unused:0,overtime:0};
    for(const b of byBranch.values())for(const f of ['capacity','used','recorded','unused','overtime'])national[f]+=b[f];
    byBranch.set('National',national);
    return{byBranch,persons,unmapped:unmapped.size};
  }
  const previousParse=parseWorkbook;
  parseWorkbook=function(buf,name){
    previousParse(buf,name);
    hydrateContractModel();
    addSelector();
    filter();
  };
  const previousSelected=selectedPeriodUtilisation;
  selectedPeriodUtilisation=function(activity,start,end){
    const dayRows=previousSelected(activity,start,end);
    if(basis!=='hours'||!modelReady)return dayRows;
    const h=selectHours(activity,start,end);
    return dayRows.map(r=>{
      const a=h.byBranch.get(r.branch)||{capacity:0,used:0,recorded:0,unused:0,overtime:0};
      return{...r,util:a.capacity>0?a.used/a.capacity:null,hoursCapacity:a.capacity,hoursUsed:a.used,hoursRecorded:a.recorded,hoursUnused:a.unused,hoursOvertime:a.overtime};
    });
  };
  const previousBuildScenario=buildCustomerScenario;
  buildCustomerScenario=function(){
    previousBuildScenario();
    if(basis!=='hours'||!modelReady)return;
    const rows=selectedPeriodUtilisation(displayActivity(),S.from||S.min,S.to||S.max);
    const lookup=new Map(rows.map(r=>[r.branch,r.util]));
    for(const r of S.viewBaseline)if(lookup.has(r.branch))r.util=lookup.get(r.branch);
  };
  function addSelector(){
    if(root.getElementById('hgUtilBasis'))return;
    const shell=root.querySelector('.hg-coex-view');
    if(!shell)return;
    const bar=document.createElement('div');
    bar.className='hg-util-selector';
    bar.innerHTML='<label for="hgUtilBasis"><strong>Utilisation calculation basis</strong></label><select id="hgUtilBasis"><option value="days">Seven-day eligible-person basis (approved)</option><option value="hours">Recorded hours / contractual weekly hours</option></select><span class="hg-util-selector-note">Changes capacity/utilisation measures throughout the dashboard; agency spending and activity totals remain independent.</span>';
    shell.insertBefore(bar,shell.firstChild);
    const sel=root.getElementById('hgUtilBasis');sel.value=basis;
    sel.addEventListener('change',()=>{
      basis=sel.value;
      S.page=1;
      filter();
    });
  }
  function fmt(n){return num.format(n);}
  function renderBasisPanels(){
    if(!modelReady)return;
    const mode=basis==='days'?'Seven-day eligible-person basis':'Contractual-hours basis';
    const h=selectHours(displayActivity(),S.from||S.min,S.to||S.max);
    const branch=S.branch==='All'?'National':S.branch,all=h.byBranch.get(branch)||{capacity:0,used:0,unused:0,overtime:0};
    const pName=normaliseName(S.person),ids=idByName.get(pName),personId=ids&&ids.size===1?[...ids][0]:null;
    const personal=personId?selectHours(displayActivity(),S.personFrom||S.from||S.min,S.personTo||S.to||S.max,personId).persons.get(personId):null;
    for(const view of ['executive','branch','people','individual','jobs','refresh']){
      const el=root.querySelector('#view-'+view);if(!el)continue;
      let panel=el.querySelector('.hg-util-basis-panel');
      if(!panel){panel=document.createElement('aside');panel.className='hg-util-basis-panel';el.insertBefore(panel,el.firstChild)}
      const ph=view==='individual'&&personal?personal:all;
      const hoursDetail=basis==='hours'
        ?'<strong>'+fmt(ph.used)+' / '+fmt(ph.capacity)+' contractual hours</strong> · '+fmt(ph.unused)+' unused hours · '+fmt(ph.overtime)+' hours above available capacity'
        :'<strong>Existing approved day-based measure</strong> · eligible fixed person-days, ADP deductions and worked person-dates';
      panel.innerHTML='<strong>'+mode+'</strong> — '+hoursDetail+
        '<div class="hg-util-secondary">Branch-specific agency overlap only. Contractual hours use the HR weekly-hours field, prorated equally across seven eligible dates; approved ADP absence reduces capacity. Missing contract hours are excluded from the hours measure ('+h.unmapped+' fixed employee IDs). Agency reliance remains person-day-based; costs and savings remain unverified.</div>';
    }
  }
  const previousRenderAll=renderAll;
  renderAll=function(){
    previousRenderAll();
    renderBasisPanels();
    const sel=root.getElementById('hgUtilBasis');if(sel&&sel.value!==basis)sel.value=basis;
    if(basis!=='hours'||!modelReady)return;
    const branch=S.branch==='All'?'National':S.branch;
    const rows=selectedPeriodUtilisation(displayActivity(),S.from||S.min,S.to||S.max);
    const byBranch=new Map(rows.map(r=>[r.branch,r]));
    const row=byBranch.get(branch);
    const util=row&&row.util!==null?fmt(row.util*100)+'%':'n.a.';
    for(const metric of ['exUtil','brUtil'])setMetric(metric,util,row&&row.util!==null?utilClass(row.util):'');
    for(const metric of ['exUtilDelta'])if($(metric))$(metric).textContent='Recorded hours / available contractual hours; seven-day prorating';
    const labels=root.querySelectorAll('#view-executive .kpi .label');
    if(labels[0])labels[0].textContent='Contractual-hour utilisation';
    const branchLabel=$('brUtil')?.closest('.kpi')?.querySelector('.label');
    if(branchLabel)branchLabel.textContent='Contractual-hour utilisation';
    const notes=root.querySelectorAll('#view-executive .kpi .note');
    if(notes[0])notes[0].textContent='Capped qualifying recorded hours ÷ weekly contracted hours, with ADP reductions';
    for(const tr of $('executiveRows').querySelectorAll('tr')){
      const b=byBranch.get(tr.cells[0]?.textContent?.trim());
      if(b&&tr.cells[1])tr.cells[1].textContent=b.util===null?'n.a.':fmt(b.util*100)+'%';
    }
    const heads=$('executiveRows')?.closest('table')?.querySelectorAll('thead th');
    if(heads&&heads[1])heads[1].textContent='Contractual-hour utilisation';
    if(heads&&heads[2])heads[2].textContent='Available fixed days (day basis)';
    const trend=$('weeklyTrendChart')?.closest('.chart-card')?.querySelector('h3');
    if(trend)trend.textContent='Weekly contractual-hour utilisation and agency person-day reliance';
    $('weeklyTrendChart').innerHTML=svgWeeklyTrend(weeklyTrendData());
    $('opportunityMatrix').innerHTML=svgOpportunityMatrix();
  };
})();
