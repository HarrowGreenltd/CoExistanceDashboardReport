/* Harrow Green — evidence-first contracted-hours capacity overlay.
 * Recorded HR hours apply from their dated effective point; 45h/five days is
 * only the explicit fallback for dates without evidenced hours. Contracted
 * hours may be deployed across seven calendar days. No personnel data is
 * embedded in this script; all figures load from the workbook.
 */
(function(){
  const idOf=v=>String(v??'').replace(/\D/g,'');
  const originalShowError=showError;
  showError=function(message=''){
    const safe=String(message).replace(/Publish index\.html and coexistence-data\.xlsx together through GitHub Pages, or use the manual workbook upload\./g,
      'Place all dashboard files on private access-controlled hosting, or use the manual workbook upload.');
    originalShowError(safe);
  };
  // A generic partial refresh cannot recalculate the governed HR/ADP hours
  // tables, so require regeneration of the complete source workbook instead.
  loadSources=async function(){
    showError('Partial source refresh is disabled for the evidence-backed HR model. Reconcile new source exports and regenerate the complete coexistence-data.xlsx, then use the dashboard workbook upload.');
    setStatus('Governed workbook refresh required','error');
  };
  const sourceUpload=$('sourceFiles');if(sourceUpload)sourceUpload.disabled=true;
  const sourceLabel=document.querySelector('label[for="sourceFiles"]');
  if(sourceLabel)sourceLabel.textContent='Source refresh requires reconciliation';
  const sourceNote=document.querySelector('#view-refresh .source-note');
  if(sourceNote)sourceNote.textContent='The HR-hours model relies on actual employee dates, dated contract changes and original ADP approved hours, with a separately flagged 45-hour fallback. Do not apply independent raw source updates here: reconcile them, regenerate the complete workbook and upload that controlled workbook instead. Only private access-controlled hosting is appropriate.';
  const hours={ready:false,daily:new Map(),eligible:new Map(),fixedIds:new Set(),leave:new Set(),audit:new Map(),branches:new Set()};
  const amount=v=>Number.isFinite(Number(v))?Number(v):0;

  function hydrateHours(){
    const cap=readTable(S.workbook,'Capacity Daily',['Date','Branch','Net Contracted Hours']);
    const weekly=readTable(S.workbook,'Contract Hours Weekly',['Employee ID','Home Branch','Week start','Contracted hours/week']);
    const employment=readTable(S.workbook,'Employment Months',['Employee Number','Inferred Active From','Inferred Active To']);
    const absence=readTable(S.workbook,'ADP Approved Dates',['Date','Employee ID']);
    const audit=readTable(S.workbook,'Hourly Rules Audit',['Control','Result']);
    if(!cap.rows.length||!weekly.rows.length||!employment.rows.length)throw new Error('The contracted-hours workbook has no eligible staff or capacity.');
    hours.daily.clear();hours.eligible.clear();hours.fixedIds.clear();hours.leave.clear();hours.audit.clear();hours.branches.clear();
    for(const r of cap.rows){
      const date=iso(excelDate(r['Date'])),branch=text(r['Branch']);
      if(!date||!branch)continue;
      hours.daily.set(`${branch}|${date}`,amount(r['Net Contracted Hours']));
      hours.branches.add(branch);
    }
    for(const r of weekly.rows){
      const id=idOf(r['Employee ID']);
      if(id)hours.fixedIds.add(id);
      const rate=amount(r['Contracted hours/week']);
      if(!(rate>0&&rate<100))throw new Error(`Weekly contracted hours are invalid for employee ID ${id}.`);
    }
    for(const r of employment.rows){
      const id=idOf(r['Employee Number']);
      if(!id)continue;
      const first=iso(excelDate(r['Inferred Active From'])),last=iso(excelDate(r['Inferred Active To']));
      if(first&&last){
        const eligible=hours.eligible.get(id)||new Set();
        for(let date=first;date<=last;date=addDays(date,1))eligible.add(date);
        hours.eligible.set(id,eligible);
      }
    }
    for(const r of absence.rows){
      const date=iso(excelDate(r['Date'])),id=idOf(r['Employee ID']);
      if(id&&date)hours.leave.add(`${id}|${date}`);
    }
    for(const r of audit.rows){
      if(text(r['Control']))hours.audit.set(text(r['Control']),r['Result']);
    }
    hours.ready=true;
  }

  const dayBasedUtilisation=selectedPeriodUtilisation;
  selectedPeriodUtilisation=function(activity,start,end){
    if(!hours.ready)return dayBasedUtilisation(activity,start,end);
    const branches=allBranches(),agency=agencyDaysByBranch(activity,start,end);
    const numerators=new Map(),workedDates=new Map();
    for(const r of activity){
      if(r.date<start||r.date>end||r.type!=='worked'||r.status!=='Permanent')continue;
      const id=idOf(r.employeeId);
      if(!id||!hours.fixedIds.has(id)||!hours.eligible.get(id)?.has(r.date)||hours.leave.has(`${id}|${r.date}`))continue;
      // The original person-date source has one worked row per ID and date.
      // Deduplicate as a safeguard if a future source repeats that same record.
      const key=`${id}|${r.date}`;
      if(workedDates.has(key))continue;
      workedDates.set(key,true);
      // Contract capacity is allocated by the employee's HR home branch.
      const home=hours.employeeBranches?.get(id)||r.homeBranch;
      numerators.set(home,(numerators.get(home)||0)+amount(r.hours));
      if(!workedDates.has(`${home}|days`))workedDates.set(`${home}|days`,0);
      workedDates.set(`${home}|days`,workedDates.get(`${home}|days`)+1);
    }
    const rows=[];
    for(const branch of branches){
      let net=0;
      for(let d=start;d<=end;d=addDays(d,1))net+=hours.daily.get(`${branch}|${d}`)||0;
      const deployed=numerators.get(branch)||0;
      rows.push({branch,util:net>0?deployed/net:null,agencyDays:agency.get(branch)||0,
        deployedDays:workedDates.get(`${branch}|days`)||0,capacity:net,
        deployedHours:deployed,capacityHours:net});
    }
    const net=rows.reduce((s,r)=>s+r.capacityHours,0),used=rows.reduce((s,r)=>s+r.deployedHours,0);
    rows.push({branch:'National',util:net>0?used/net:null,agencyDays:agency.get('National')||0,
      deployedDays:rows.reduce((s,r)=>s+r.deployedDays,0),capacity:net,
      deployedHours:used,capacityHours:net});
    return rows;
  };

  const priorParseWorkbook=parseWorkbook;
  parseWorkbook=function(buffer,name){
    hours.ready=false;
    priorParseWorkbook(buffer,name);
    try{
      const weekly=readTable(S.workbook,'Contract Hours Weekly',['Employee ID','Home Branch']);
      hours.employeeBranches=new Map(weekly.rows.map(r=>[idOf(r['Employee ID']),text(r['Home Branch'])]));
      hydrateHours();
      filter();
    }catch(error){
      hours.ready=false;
      console.error('Contracted-hours validation failed',error);
      showError('Contracted-hours data could not be validated: '+error.message);
      setStatus('Contracted-hours workbook required','error');
      showUpload(true);
      filter();
    }
  };

  const priorBuildScenario=buildCustomerScenario;
  buildCustomerScenario=function(){
    priorBuildScenario();
    if(!hours.ready)return;
    const from=S.from||S.min,to=S.to||S.max;
    S.viewCurrent=selectedPeriodUtilisation(displayActivity(),from,to);
    S.periodAllCurrent=selectedPeriodUtilisation(S.activity,from,to);
  };

  function renderHourAudit(row){
    const panel=$('hrAuditSummary');
    if(!panel)return;
    const get=k=>whole.format(amount(hours.audit.get(k)));
    panel.innerHTML=`<h3 style="margin:0 0 10px">Contracted-hours model — source integrity</h3>
      <p style="margin:0 0 10px"><strong>Evidence first:</strong> recorded HR weekly hours and actual joining/leaving dates determine capacity where available. Before an evidenced weekly-hours effective date, or if none exists, a five-day / 45-hour fallback applies. Hours can be deployed across seven calendar days. Original ADP-approved leave hours reduce availability.</p>
      <p style="margin:0 0 10px"><strong>${num.format(row?.deployedHours||0)}</strong> matched fixed-person worked hours / <strong>${num.format(row?.capacityHours||0)}</strong> net available contracted hours for the selected period and customer view.</p>
      <p style="margin:0"><strong>${get('Recorded weekly hours applicable during analysis')}</strong> people with dated HR contract hours · <strong>${get('Employees without evidenced weekly hours')}</strong> with no HR hours · <strong>${get('Assumption-affected calendar employee dates')}</strong> employee-dates on 45h fallback · <strong>${get('HR starting-month records adjusted to exact date')}</strong> HR start-date adjustments · <strong>${get('Weeks with ADP hours greater than eligible contract hours')}</strong> leave-over-capacity weeks · <strong>${get('Permanent worked records outside actual HR tenure')}</strong> work/tenure contradictions · <strong>${get('Agency-tagged work records with a fixed HR employee ID')}</strong> worker-class contradictions.</p>
      <p style="margin:10px 0 0;font-size:12px">Exceptions remain open. Week-spanning leave hours are allocated proportionally across calendar dates and capped at eligible weekly capacity. Unevidenced historical hours remain an assumption, not contractual evidence. Work hours outside sourced tenure are excluded pending review.</p>`;
  }

  const priorRenderAll=renderAll;
  renderAll=function(){
    priorRenderAll();
    if(!hours.ready){
      for(const id of ['exUtil','brUtil'])setMetric(id,'Not validated');
      const note=$('exUtilDelta');if(note)note.textContent='Upload the contracted-hours workbook';
      return;
    }
    const from=S.from||S.min,to=S.to||S.max;
    const rows=selectedPeriodUtilisation(displayActivity(),from,to),byBranch=new Map(rows.map(r=>[r.branch,r]));
    const selected=byBranch.get(S.branch==='All'?'National':S.branch);
    const formatted=selected?.util===null||selected?.util===undefined?'n.a.':`${num.format(selected.util*100)}%`;
    // No traffic-light status: no utilisation target has been approved.
    for(const id of ['exUtil','brUtil'])setMetric(id,formatted);
    const executiveLabel=document.querySelector('#view-executive .kpi .label');
    if(executiveLabel)executiveLabel.textContent='Evidence-first hours utilisation';
    const branchLabel=$('brUtil')?.closest('.kpi')?.querySelector('.label');
    if(branchLabel)branchLabel.textContent='Evidence-first hours utilisation';
    const notes=document.querySelectorAll('#view-executive .kpi .note');
    if(notes[0])notes[0].textContent='Matched fixed worked hours ÷ HR hours from effective date, with 45h fallback and approved ADP leave deductions';
    if($('exUtilDelta'))$('exUtilDelta').textContent=`${num.format(selected?.deployedHours||0)} worked hours / ${num.format(selected?.capacityHours||0)} available hours`;
    for(const tr of $('executiveRows')?.querySelectorAll('tr')||[]){
      const branch=tr.cells[0]?.textContent?.trim(),r=byBranch.get(branch);
      if(!r)continue;
      if(tr.cells[1])tr.cells[1].textContent=r.util===null?'n.a.':`${num.format(r.util*100)}%`;
      if(tr.cells[2])tr.cells[2].textContent=num.format(r.capacityHours);
    }
    const headers=$('executiveRows')?.closest('table')?.querySelectorAll('thead th');
    if(headers?.[1])headers[1].textContent='Evidence-first utilisation';
    if(headers?.[2])headers[2].textContent='Net contracted hours';
    const personHeaders=$('insightRows')?.closest('table')?.querySelectorAll('thead th');
    if(personHeaders?.[5])personHeaders[5].textContent='Calendar dates without work';
    const roleHeaders=$('roleRows')?.closest('table')?.querySelectorAll('thead th');
    if(roleHeaders?.[7])roleHeaders[7].textContent='Calendar dates without work';
    const scope=document.querySelector('#view-executive .action-note');
    if(scope)scope.textContent='Recorded HR start/leaving dates and contracted hours take precedence. Before an HR hours-effective date, 45h is used only as a flagged fallback. Capacity is deployable across seven days; approved ADP leave hours reduce it. Financial exposure remains withheld.';
    const intro=document.querySelector('#view-executive .heading.first p');
    if(intro)intro.textContent='Recorded worked hours and HR-evidenced capacity with clearly identified 45h gaps. Agency spend is separately reconciled; financial savings remain unverified.';
    const branchIntro=document.querySelector('#view-branch .heading.first p');
    if(branchIntro)branchIntro.textContent='Modelled fixed-workforce contracted hours, seven-day deployment flexibility and recorded activity.';
    const trendTitle=$('weeklyTrendChart')?.closest('.chart-card')?.querySelector('h3');
    if(trendTitle)trendTitle.textContent='Weekly evidence-first contracted-hours utilisation and agency reliance';
    if($('weeklyTrendChart'))$('weeklyTrendChart').innerHTML=svgWeeklyTrend(weeklyTrendData());
    const subtitle=document.querySelector('.top .sub');
    if(subtitle)subtitle.textContent='Recorded deployment / dated HR contracts / 45h fallback / ADP-approved leave';
    const footer=document.querySelector('.footer');
    if(footer)footer.textContent='Restricted HR workbook. Recorded HR hours and dates take precedence; 45h is a fallback only where hours are not evidenced. Seven-day deployment does not add weekly hours. Agency spend is the sum of nine branch source formulas. No financial savings are asserted.';
    renderHourAudit(selected);
  };
})();
