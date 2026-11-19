"""Independent read-only regression checks of the four-KPI dashboard model."""
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
import openpyxl
import re

source=Path(__file__).resolve().parent.parent/'dashboard_html'/'coexistence-data.xlsx'
book=openpyxl.load_workbook(source,read_only=True,data_only=True)

def table(name,marker):
    records=iter(book[name].values)
    for row in records:
        if marker in row:
            headers={str(v):i for i,v in enumerate(row) if v is not None}
            break
    return (dict(zip(headers,(r[i] for i in headers.values()))) for r in records)

def day(v):return date.fromisoformat(str(v)[:10]) if v else None
def ident(v):return re.sub(r'\D','',str(v or ''))
def normal(v):return re.sub(r'[^a-z0-9]','',str(v or '').lower())
def amount(v):return float(v or 0)

eligible=defaultdict(list);names=defaultdict(set);fixed=set();branches={}
for r in table('Employment Months','Employee Number'):
    i=ident(r['Employee Number'])
    if not i:continue
    if r['Fixed / Overheads']=='Fixed':fixed.add(i)
    names[normal(r['Employee'])].add(i)
    branches[i]=r['Home Branch']
    a,b=day(r['Inferred Active From']),day(r['Inferred Active To'])
    if a and b:eligible[i].append((a,b))
for r in table('Contract Hours Weekly','Employee ID'):
    i=ident(r['Employee ID'])
    if i and r['Home Branch']:branches[i]=r['Home Branch']
leave={(ident(r['Employee ID']),day(r['Date'])) for r in table('ADP Approved Dates','Employee ID')}

permanent_days=defaultdict(set);agency_days=defaultdict(set);agency_hours=defaultdict(float)
for r in table('Activity Daily Summary','Employee ID'):
    d=day(r['Date']);status=r['Employment Status'];h=amount(r['Actual Hours'])
    if not d or not str(r['Activity Code'] or '').lower().startswith('worked') or h<=0:continue
    w=d+timedelta(days=6-d.weekday())
    if status=='Agency/External':
        key=(r['Activity Branch'],w)
        agency_days[key].add((normal(r['Name']),d))
        agency_hours[key]+=h
    elif status=='Permanent':
        i=ident(r['Employee ID'])
        if not i and len(names.get(normal(r['Name']),set()))==1:i=next(iter(names[normal(r['Name'])]))
        if i not in fixed or not any(a<=d<=b for a,b in eligible[i]) or (i,d) in leave:continue
        if branches.get(i):permanent_days[(branches[i],w)].add((i,d))

covered=[r for r in table('Weekly Coexistence','Week ending') if amount(r['CT complete-week coverage'])==1]
assert len(covered)==369,len(covered)
for r in covered:
    k=(r['Branch'],day(r['Week ending']))
    assert abs(agency_hours[k]-amount(r['Diary agency recorded hours']))<0.02,(k,agency_hours[k],r['Diary agency recorded hours'])

for basis in ('days','hours'):
    totals=defaultdict(float)
    for r in covered:
        k=(r['Branch'],day(r['Week ending']))
        capacity=amount(r['Net contracted hours'])
        worked=len(permanent_days[k])*9 if basis=='days' else amount(r['Matched permanent worked hours'])
        unused=max(0,capacity-worked)
        deployed=amount(r['Diary agency recorded hours'])
        ct_hours=amount(r['CT billed hourly agency units'])
        hourly=amount(r['CT hourly agency cost (£)'])
        rate=amount(r['Legacy permanent hourly rate (£)'])
        matched=min(unused,deployed) if unused>0 and deployed>0 else 0
        opportunity=min(hourly,matched*hourly/ct_hours) if ct_hours>0 else 0
        leftover_hours=max(0,unused-matched)
        totals['agency_billed']+=amount(r['CT total billed cost (£)'])
        totals['agency_unit_hours']+=deployed
        totals['ct_billed_hours']+=ct_hours
        totals['agency_days']+=len(agency_days[k])
        totals['unused_hours']+=unused
        totals['unused_cost']+=unused*rate
        totals['matched_hours']+=matched
        totals['matched_perm']+=matched*rate
        totals['coexistence']+=matched*rate+opportunity
        totals['agency_opportunity']+=opportunity
        totals['other_unused_hours']+=leftover_hours
        totals['other_unused_cost']+=leftover_hours*rate
        totals['branch_weeks']+=1
        totals['coexist_weeks']+=int(matched>0)
    assert abs(totals['unused_cost']-totals['matched_perm']-totals['other_unused_cost'])<0.03
    assert abs(totals['agency_unit_hours']-72151.71)<0.03
    assert abs(totals['ct_billed_hours']-69503.78333333334)<0.03
    assert abs(totals['agency_billed']-1358850.5)<0.03
    assert totals['agency_days']==8019
    assert 0<=totals['agency_opportunity']<=totals['agency_billed']
    print(basis,{k:round(v,2) for k,v in totals.items()})
    print('total_inefficiency',round(totals['unused_cost']+totals['agency_opportunity'],2))
