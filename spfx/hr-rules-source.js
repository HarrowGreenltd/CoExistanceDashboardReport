/* Harrow Green: controlled HR date, ADP absence and agency-spend overlay.
 * All data comes from coexistence-data.xlsx; no employee data is hardcoded here.
 */
(function(){
  const normId=v=>String(v??'').replace(/[^0-9]/g,'');
  const normName=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const days=(a,b)=>{let result=[];for(let d=a;d&&d<=b;d=addDays(d,1))result.push(d);return result};
  const hr={ready:false,net:new Map(),eligible:new Map(),roster:new Map(),nameIds:new Map(),leave:new Set(),agency:[],agencyBranches:[],weekMax:'',totalSpend:0,audit:{}};

  function hydrate(){
    const capacity=readTable(S.workbook,'Capacity Daily',['Date','Branch','Net Available Fixed Employees'],true);
    const months=readTable(S.workbook,'Employment Months',['Employee Number','Month','Inferred Active From','Inferred Active To'],true);
    const leave=readTable(S.workbook,'ADP Approved Dates',['Date','Employee ID','Leave class'],true);
    const agency=readTable(S.workbook,'Agency Spend',['Week ending','Selected 9-branch total (£)'],true);
    const profiles=readTable(S.workbook,'People Insight',['Home Branch','Employee','Employee Number','Assigned Role'],true);
    if(!capacity?.rows?.length||!months?.rows?.length||!leave?.rows?.length||!agency?.rows?.length)throw new Error('HR-rule sheets missing. Use the updated coexistence-data.xlsx alongside this dashboard.');
    hr.net=new Map();hr.eligible=new Map();hr.roster=new Map();hr.nameIds=new Map();hr.leave=new Set();
    const fallbackIds=new Set();let overriddenMonths=0;
    for(const r of capacity.rows){
      const d=iso(excelDate(r['Date'])),branch=text(r['Branch']);
      if(d&&branch)hr.net.set(`${branch}|${d}`,val(r['Net Available Fixed Employees']));
    }
    for(const r of months.rows){
      const id=normId(r['Employee Number']),branch=text(r['Home Branch']);
      if(!id)continue;
      if(!hr.roster.has(id))hr.roster.set(id,{id,branch,fixed:text(r['Fixed / Overheads'])==='Fixed'});
      const n=normName(r['Employee']);
      if(n){if(!hr.nameIds.has(n))hr.nameIds.set(n,new Set());hr.nameIds.get(n).add(id)}
      const first=iso(excelDate(r['Inferred Active From'])),last=iso(excelDate(r['Inferred Active To']));
      if(text(r['Inference Rule']).startsWith('Monthly 0/1 fallback'))fallbackIds.add(id);
      if(Number(r['Employed Flag'])!==Number(Boolean(first&&last)))overriddenMonths++;
      if(first&&last){const set=hr.eligible.get(id)||new Set();for(const d of days(first,last))set.add(d);hr.eligible.set(id,set)}
    }
    for(const r of leave.rows){const d=iso(excelDate(r['Date'])),id=normId(r['Employee ID']);if(id&&d)hr.leave.add(`${id}|${d}`)}
    for(const r of S.activity){
      const name=normName(r.name),ids=hr.nameIds.get(name);
      if(!r.employeeId&&ids?.size===1)r.employeeId=[...ids][0];
      if(r.employeeId){if(!hr.nameIds.has(name))hr.nameIds.set(name,new Set());hr.nameIds.get(name).add(normId(r.employeeId))}
    }
    hr.agencyBranches=Object.keys(agency.rows[0]).filter(h=>h.endsWith(' (£)')&&h!=='National hardcoded (£)'&&h!=='Selected 9-branch total (£)'&&h!=='Source difference (£)');
    hr.agency=agency.rows.map(r=>{
      const branches=Object.fromEntries(hr.agencyBranches.map(h=>[h.replace(/ \(£\)$/,''),val(r[h])]));
      const selected=Math.round((Object.values(branches).reduce((sum,v)=>sum+v,0)+Number.EPSILON)*100)/100;
      const formula=val(r['Selected 9-branch total (£)']);
      if(Math.abs(selected-formula)>.011)throw new Error(`Agency branch formula does not reconcile for ${r['Week ending']}.`);
      return {week:iso(excelDate(r['Week ending'])),national:val(r['National hardcoded (£)']),selected,branches};
    }).filter(r=>r.week);
    hr.weekMax=hr.agency.at(-1)?.week||'';
    hr.totalSpend=hr.agency.reduce((sum,r)=>sum+r.selected,0);
    hr.audit={fallbackStaff:fallbackIds.size,overriddenMonths,
      unmatchedPermanent:S.activity.filter(r=>r.status==='Permanent'&&r.type==='worked'&&!r.employeeId).length,
      unmatchedAgency:S.activity.filter(r=>r.status==='Agency/External'&&r.type==='worked'&&!r.employeeId).length,
      workedLeave:S.activity.filter(r=>r.type==='conflict').length,
      agencyVarianceWeeks:hr.agency.filter(r=>Math.abs(r.national-r.selected)>.011).length};
    if(profiles?.rows?.length){
      S.insight=profiles.rows.map(r=>({homeBranch:text(r['Home Branch']),employee:text(r['Employee']),employeeNumber:normId(r['Employee Number']),role:text(r['Assigned Role']),
        workPattern:text(r['Availability Basis']),weeklyDays:val(r['Assumed Available Days per Week']),scheduled:val(r['Net Available Person-Days YTD']),
        deployed:val(r['Deployed Days']),annual:val(r['Annual Leave Days']),otherLeave:val(r['Other Leave Days']),
        noDeployment:val(r['No Deployment Available Days']),overlap:val(r['Potential Overlap Days']),cross:val(r['Cross-Branch Support Days']),
        multiJob:val(r['Multi-Job Days']),hours:val(r['Actual Hours']),avgHours:val(r['Average Hours / Deployed Day']),
        conflicts:val(r['Conflict Days']),interpretation:text(r['Indicative Interpretation'])})).filter(r=>r.employee);
    }
    hr.ready=true;
  }

  function renderAuditSummary(){
    if(!hr.ready)return;
    const target=document.querySelector('#view-executive .kpis');
    if(!target)return;
    let panel=document.getElementById('hrAuditSummary');
    if(!panel){panel=document.createElement('article');panel.id='hrAuditSummary';panel.className='panel';panel.style.margin='18px 0';panel.style.padding='20px 24px';target.insertAdjacentElement('afterend',panel)}
    const a=hr.audit;
    panel.innerHTML=`<h3 style="margin:0 0 10px">HR and data integrity — remaining exceptions</h3>
      <p style="margin:0 0 10px">Applied: full joining month; HR leaving date; all seven calendar days eligible; approved ADP absence overrides diary leave; agency spend uses the nine-branch formula sum.</p>
      <p style="margin:0"><strong>${whole.format(a.overriddenMonths)}</strong> HR overrides of monthly flags · <strong>${whole.format(a.fallbackStaff)}</strong> roster IDs without dated HR tenure · <strong>${whole.format(a.workedLeave)}</strong> work/ADP absence conflicts · <strong>${whole.format(a.unmatchedPermanent)}</strong> unmatched permanent work records · <strong>${whole.format(a.unmatchedAgency)}</strong> unmatched agency work records · <strong>${whole.format(a.agencyVarianceWeeks)}</strong> agency accounting weeks with source variance.</p>
      <p style="margin:10px 0 0;font-size:12px">Exceptions are retained for review; unmatched permanent work records are excluded from daily utilisation. Day-based availability is a modelling convention, not contractual capacity.</p>`;
  }

  const previousParseActivity=parseActivity;
  parseActivity=function(wb){
    const out=previousParseActivity(wb);
    const t=readTable(wb,'Activity Daily Summary',['Date','Name','Employee ID'],true);
    if(t?.rows?.length){
      const map=new Map();for(const r of t.rows)map.set(`${normName(r['Name'])}|${iso(excelDate(r['Date']))}`,normId(r['Employee ID']));
      for(const r of out.rows)r.employeeId=map.get(`${normName(r.name)}|${r.date}`)||'';
    }
    return out;
  };

  const previousParseWorkbook=parseWorkbook;
  parseWorkbook=function(buf,name){
    hr.ready=false;
    previousParseWorkbook(buf,name);
    try{hydrate();filter()}catch(e){console.error(e);showError(e.message);setStatus('HR-rule workbook required','error');showUpload(true)}
  };

  // Capacity and deployment are measured in PERSON-DATES, not contracted hours.
  const previousSelectedPeriodUtilisation=selectedPeriodUtilisation;
  selectedPeriodUtilisation=function(activity,start,end){
    if(!hr.ready)return previousSelectedPeriodUtilisation(activity,start,end);
    const branches=allBranches(),ag=agencyDaysByBranch(activity,start,end),sets=new Map();
    for(const r of activity){
      if(r.date<start||r.date>end||r.type!=='worked'||r.status!=='Permanent')continue;
      const id=normId(r.employeeId),employee=hr.roster.get(id);
      if(!employee?.fixed||!employee.branch||!hr.eligible.get(id)?.has(r.date)||hr.leave.has(`${id}|${r.date}`))continue;
      if(!sets.has(employee.branch))sets.set(employee.branch,new Set());
      sets.get(employee.branch).add(`${id}|${r.date}`);
    }
    const all=[];
    for(const branch of branches){let capacity=0;for(const day of days(start,end))capacity+=hr.net.get(`${branch}|${day}`)||0;
      const deployed=sets.get(branch)?.size||0;
      all.push({branch,util:capacity?deployed/capacity:null,agencyDays:ag.get(branch)||0,deployedDays:deployed,capacity});
    }
    const cap=all.reduce((s,r)=>s+r.capacity,0),dep=all.reduce((s,r)=>s+r.deployedDays,0);
    all.push({branch:'National',util:cap?dep/cap:null,agencyDays:ag.get('National')||0,deployedDays:dep,capacity:cap});
    return all;
  };

  const previousBuildCustomerScenario=buildCustomerScenario;
  buildCustomerScenario=function(){
    previousBuildCustomerScenario();
    if(!hr.ready)return;
    const a=S.from||S.min,b=S.to||S.max;
    S.viewCurrent=selectedPeriodUtilisation(displayActivity(),a,b);
    S.periodAllCurrent=selectedPeriodUtilisation(S.activity,a,b);
    S.viewInsight=scenarioInsights(displayActivity());
  };

  scenarioInsights=function(activity){
    const from=S.from||S.min,to=S.to||S.max;
    const byId=new Map(),agencyWeeks=new Set();
    for(const r of activity){
      const id=normId(r.employeeId);
      if(id){const list=byId.get(id)||[];list.push(r);byId.set(id,list)}
      if(r.status==='Agency/External'&&r.type==='worked')agencyWeeks.add(`${r.homeBranch}|${r.assignedRole}|${startOfWeek(r.date)}`);
    }
    return S.insight.map(p=>{
      const id=normId(p.employeeNumber),rows=byId.get(id)||[],eligible=hr.eligible.get(id)||new Set(),available=[...eligible].filter(d=>d>=from&&d<=to&&!hr.leave.has(`${id}|${d}`));
      const dep=new Set(rows.filter(r=>r.type==='worked'&&eligible.has(r.date)&&!hr.leave.has(`${id}|${r.date}`)).map(r=>r.date));
      const annual=new Set(rows.filter(r=>r.type==='annual'||(r.type==='conflict'&&/annual/i.test(r.code))).map(r=>r.date));
      const other=new Set(rows.filter(r=>r.type==='other'||(r.type==='conflict'&&!/annual/i.test(r.code))).map(r=>r.date));
      const noDeployment=Math.max(0,available.length-dep.size);
      const overlap=available.filter(d=>!dep.has(d)&&agencyWeeks.has(`${p.homeBranch}|${p.role}|${startOfWeek(d)}`)).length;
      const work=rows.filter(r=>r.type==='worked'||r.type==='conflict');
      return {...p,scheduled:available.length,deployed:dep.size,annual:annual.size,otherLeave:other.size,noDeployment,
        overlap:Math.min(overlap,noDeployment),cross:new Set(work.filter(r=>r.crossBranch).map(r=>r.date)).size,
        multiJob:new Set(work.filter(r=>r.multiJob).map(r=>r.date)).size,
        hours:work.reduce((n,r)=>n+r.hours,0),conflicts:rows.filter(r=>r.type==='conflict').length};
    });
  };

  function amount(branch){
    if(!hr.ready)return null;
    if(branch==='All')return hr.totalSpend;
    return hr.agency.reduce((sum,r)=>sum+(r.branches[branch]||0),0);
  }
  function addSpendCard(container,id){
    const wrap=document.querySelector(container);
    if(!wrap||document.getElementById(id))return;
    const card=document.createElement('article');card.className='panel kpi';
    card.innerHTML=`<span class="label">Agency spend (YTD to 8 Nov)</span><div id="${id}" class="value">—</div><div class="note">Sum of branch costings; independent of activity date filter</div>`;
    wrap.appendChild(card);
  }
  addSpendCard('#view-executive .kpis','exAgencySpend');
  addSpendCard('#view-branch .kpis','brAgencySpend');

  const previousRenderAll=renderAll;
  renderAll=function(){
    previousRenderAll();
    if(!hr.ready)return;
    renderAuditSummary();
    const dayRow=selectedPeriodUtilisation(displayActivity(),S.from||S.min,S.to||S.max).find(r=>r.branch===(S.branch==='All'?'National':S.branch));
    const u=dayRow?.util;
    const formatted=u===null||u===undefined?'n.a.':num.format(u*100)+'%';
    for(const id of ['exUtil','brUtil'])setMetric(id,formatted,u===null?'':utilClass(u));
    const executiveLabels=document.querySelectorAll('#view-executive .kpi .label');
    if(executiveLabels[0])executiveLabels[0].textContent='Daily fixed-person utilisation';
    const branchLabel=$('brUtil')?.closest('.kpi')?.querySelector('.label');
    if(branchLabel)branchLabel.textContent='Daily fixed-person utilisation';
    const notes=document.querySelectorAll('#view-executive .kpi .note');
    if(notes[0])notes[0].textContent='Matched work person-dates / available fixed-person dates (HR dates, 7-day week, ADP absence excluded)';
    $('exUtilDelta').textContent='User-confirmed daily availability basis';
    $('weeklyTrendChart').innerHTML=svgWeeklyTrend(weeklyTrendData());
    const branchRows=selectedPeriodUtilisation(displayActivity(),S.from||S.min,S.to||S.max);
    const branchMap=new Map(branchRows.map(r=>[r.branch,r]));
    for(const tr of $('executiveRows').querySelectorAll('tr')){
      const branch=tr.cells[0]?.textContent?.trim(),r=branchMap.get(branch);
      if(r&&tr.cells[1])tr.cells[1].textContent=r.util===null?'n.a.':num.format(r.util*100)+'%';
      if(r&&tr.cells[2])tr.cells[2].textContent=whole.format(r.capacity);
    }
    const headers=$('executiveRows')?.closest('table')?.querySelectorAll('thead th');
    if(headers?.[1])headers[1].textContent='Daily utilisation';
    if(headers?.[2])headers[2].textContent='Available fixed days';
    const people=insightRows();
    const byNameBranch=new Map(people.map(p=>[`${p.employee}|${p.homeBranch}`,p.noDeployment]));
    for(const tr of $('insightRows').querySelectorAll('tr')){
      const key=`${tr.cells[0]?.textContent?.trim()}|${tr.cells[1]?.textContent?.trim()}`;
      if(tr.cells[5]&&byNameBranch.has(key))tr.cells[5].textContent=whole.format(byNameBranch.get(key));
    }
    const roleNoWork=new Map();
    for(const p of people)roleNoWork.set(p.role,(roleNoWork.get(p.role)||0)+p.noDeployment);
    for(const tr of $('roleRows').querySelectorAll('tr')){
      const role=tr.cells[0]?.textContent?.trim();
      if(tr.cells[7]&&roleNoWork.has(role))tr.cells[7].textContent=whole.format(roleNoWork.get(role));
    }
    const scope=document.querySelector('#view-executive .action-note');
    if(scope)scope.textContent='Availability assumes all calendar dates, with the entire joining month counted and HR leaving dates applied. ADP-approved absence dates are excluded. This is a day-based operational measure, not contracted-hours or payroll FTE utilisation.';
    const executiveIntro=document.querySelector('#view-executive .heading.first p');
    if(executiveIntro)executiveIntro.textContent='Daily deployment and availability on the confirmed HR/ADP rules; financial savings still under audit.';
    const branchIntro=document.querySelector('#view-branch .heading.first p');
    if(branchIntro)branchIntro.textContent='Day-based workforce availability, recorded activity and branch-level source exceptions.';
    const subtitle=document.querySelector('.top .sub');
    if(subtitle)subtitle.textContent='HR-dated daily availability, ADP absence and agency cost evidence';
    const matrixNote=$('opportunityMatrix')?.closest('.chart-card')?.querySelector('p');
    if(matrixNote)matrixNote.textContent='Financial opportunity modelling is still withheld pending confirmed marginal agency costs and substitutable capacity.';
    const trendHeading=$('weeklyTrendChart')?.closest('.chart-card')?.querySelector('h3');
    if(trendHeading)trendHeading.textContent='Weekly daily-utilisation and agency reliance';
    const spend=amount(S.branch);
    if(spend!==null){setMetric('exAgencySpend',gbp.format(spend));setMetric('brAgencySpend',gbp.format(spend))}
    if($('freshFinance'))$('freshFinance').textContent='Agency spend through 8 Nov 2026; cost baseline remains earlier model';
    if($('inUnrecorded')){
      const calendarNote=$('inUnrecorded')?.closest('.mini-kpi')?.querySelector('.note');
      if(calendarNote)calendarNote.textContent='Calendar-day gap screening, after HR eligibility and ADP absence';
    }
    const footer=document.querySelector('.footer');
    if(footer)footer.textContent='HR daily availability and ADP absence use the agreed rules dated 16 November 2026. Agency spend is the nine-branch formula sum. Historical cost exposure, employee identity exceptions and work-versus-leave conflicts still require review. Restricted access only.';
  };

  const previousRenderCalendar=renderCalendar;
  renderCalendar=function(){
    previousRenderCalendar();
    if(!hr.ready||!S.person)return;
    const idSet=hr.nameIds.get(normName(S.person));
    const label=$('inUnrecorded')?.closest('.mini-kpi')?.querySelector('.label');
    if(label)label.textContent='Available days without work';
    if(!idSet||idSet.size!==1){setMetric('inUnrecorded','n.a.');return}
    const id=[...idSet][0],period=S.personFrom&&S.personTo?{from:S.personFrom,to:S.personTo}:null;
    if(!period)return;
    const eligible=hr.eligible.get(id)||new Set();
    const available=[...eligible].filter(d=>d>=period.from&&d<=period.to&&!hr.leave.has(`${id}|${d}`));
    const works=new Set(S.activity.filter(r=>r.employeeId===id&&r.type==='worked'&&r.date>=period.from&&r.date<=period.to).map(r=>r.date));
    setMetric('inUnrecorded',whole.format(Math.max(0,available.filter(d=>!works.has(d)).length)));
  };

  const previousRenderIndividualSummary=renderIndividualSummary;
  renderIndividualSummary=function(){
    previousRenderIndividualSummary();
    if(!hr.ready)return;
    const headers=$('individualSummaryRows')?.closest('table')?.querySelectorAll('thead th');
    if(headers?.[4])headers[4].textContent='Available days without work';
    const candidates=hr.nameIds.get(normName(S.person));
    const id=candidates?.size===1?[...candidates][0]:null;
    const eligible=id?hr.eligible.get(id)||new Set():new Set();
    const worked=new Set(id?S.activity.filter(r=>normId(r.employeeId)===id&&r.type==='worked').map(r=>r.date):[]);
    for(const tr of $('individualSummaryRows').querySelectorAll('tr')){
      const button=tr.querySelector('.open-period'),key=button?.dataset.key,mode=button?.dataset.mode;
      if(!tr.cells[4]||!key||!id){if(tr.cells[4])tr.cells[4].textContent='n.a.';continue}
      const first=mode==='month'?startOfMonth(key):key;
      const last=mode==='month'?endOfMonth(key):addDays(key,6);
      const noWork=[...eligible].filter(d=>d>=S.min&&d<=S.max&&d>=first&&d<=last&&!hr.leave.has(`${id}|${d}`)&&!worked.has(d)).length;
      tr.cells[4].textContent=whole.format(noWork);
    }
  };
})();
