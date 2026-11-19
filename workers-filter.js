/* Harrow Green – workforce drill-down controls.
   This is deliberately a presentation filter: the financial branch-week cost
   model is never recomputed from a filtered subset of worker records. */
(function(){
'use strict';
const worker={mode:'all'};
const isAgency=r=>r?.status==='Agency/External';
const matches=r=>worker.mode==='all'||(worker.mode==='agency'?isAgency(r):!isAgency(r));
const grid=document.querySelector('.filter-grid');
if(grid){
 const field=document.createElement('div');field.className='field workforce-field';
 field.innerHTML='<label for="workerMode">Workforce records</label><select id="workerMode" class="input" title="Filter people, individual, branch activity and job/customer drill-downs. Financial costs remain based on all workers."><option value="all">Permanent + agency</option><option value="permanent">Exclude agency (permanent only)</option><option value="agency">Agency only</option></select>';
 const hint=document.createElement('span');hint.className='workforce-hint';hint.textContent='Activity drill-downs only · financial headline unchanged';field.appendChild(hint);
 grid.appendChild(field);
 document.getElementById('workerMode').addEventListener('change',e=>{worker.mode=e.target.value;S.page=1;filter()});
}
const previousFilteredRows=filteredRows;
filteredRows=function(){return previousFilteredRows().filter(matches)};
const previousPersonCandidates=personCandidates;
personCandidates=function(){
 const candidates=previousPersonCandidates();
 if(worker.mode==='all')return candidates;
 const qualifying=new Set(S.activity.filter(r=>matches(r)&&(S.branch==='All'||r.homeBranch===S.branch)&&(!S.from||r.date>=S.from)&&(!S.to||r.date<=S.to)).map(r=>r.name));
 return candidates.filter(name=>qualifying.has(name));
};
const agencyNames=()=>new Set(S.activity.filter(isAgency).map(r=>r.name));
const badge='<span class="agency-flag" title="Agency / external worker" aria-label="Agency worker">A</span>';
function annotateNameCell(cell){
 if(!cell||cell.querySelector('.agency-flag'))return;
 const value=cell.textContent.trim();
 if(agencyNames().has(value))cell.insertAdjacentHTML('beforeend',badge);
}
function annotatePeople(){
 const agency=agencyNames();
 for(const row of document.querySelectorAll('#peopleRows tr')){
  const cell=row.querySelector('td:first-child');if(cell&&agency.has(cell.textContent.trim()))annotateNameCell(cell);
 }
 const kpi=document.getElementById('peContracted')?.closest('.kpi');
 if(kpi&&worker.mode!=='all'){
  const label=kpi.querySelector('.label');if(label)label.textContent=worker.mode==='agency'?'Agency people in view':'Permanent people in view';
  setMetric('peContracted',whole.format(new Set(S.filtered.filter(matches).map(r=>r.name)).size));
 }else if(kpi){const label=kpi.querySelector('.label');if(label)label.textContent='Contracted employees';}
 const scope=document.getElementById('peopleScope');
 if(scope&&worker.mode!=='all')scope.textContent+=worker.mode==='agency'?' · Agency workers only':' · Agency excluded';
}
const previousRenderPeople=renderPeople;
renderPeople=function(){previousRenderPeople();annotatePeople()};
const previousRenderDetail=renderDetail;
renderDetail=function(){previousRenderDetail();
 const agency=agencyNames();
 for(const row of document.querySelectorAll('#detailRows tr')){
  const cell=row.querySelector('td:nth-child(2) .primary-cell');if(cell&&agency.has(cell.textContent.trim()))annotateNameCell(cell);
 }
};
const previousUpdatePersonList=updatePersonList;
updatePersonList=function(){previousUpdatePersonList();
 const agency=agencyNames(),person=document.getElementById('person');
 if(person)for(const option of person.options){const realName=option.value;if(agency.has(realName)){option.value=realName;option.textContent=`${realName}  [A]`;}}
};
const previousRenderCalendar=renderCalendar;
renderCalendar=function(){previousRenderCalendar();
 const scope=document.getElementById('individualScope'),agency=agencyNames();
 if(scope&&agency.has(S.person)){const badgeEl=document.createElement('span');badgeEl.className='agency-flag';badgeEl.title='Agency / external worker';badgeEl.textContent='A';scope.append(' ',badgeEl)}
};
const previousPeriodRows=personPeriodRows;
personPeriodRows=function(){return previousPeriodRows().filter(matches)};
const previousRenderBranch=renderBranch;
renderBranch=function(){previousRenderBranch();
 const scope=document.getElementById('branchScope');
 if(scope&&worker.mode!=='all')scope.textContent+=' · '+(worker.mode==='agency'?'Agency activity only':'Permanent activity only');
 if(worker.mode==='agency'){
  const insight=document.getElementById('insightRows');
  if(insight)insight.innerHTML='<tr><td class="empty" colspan="10">Permanent-employee capacity audit is not an agency-worker drill-down.</td></tr>';
 }
};
const previousRenderJobs=renderJobs;
renderJobs=function(){previousRenderJobs();
 const scope=document.getElementById('jobsScope');
 if(scope&&worker.mode!=='all')scope.textContent+=worker.mode==='agency'?' · Agency workers only':' · Agency excluded';
};
const reset=document.getElementById('reset');
if(reset)reset.addEventListener('click',()=>{worker.mode='all';const select=document.getElementById('workerMode');if(select)select.value='all';filter()});
})();
