'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..'),dest=path.join(root,'src/webparts/coexistenceDashboard');
const html=fs.readFileSync(path.join(repo,'index.html'),'utf8');
const names=['hr-rules.js','hr-hours.js','coexistence.js','workers-filter.js'];
const expected={
'index.html':'29ab1382b7c80ac586f5949ba396e6e0ade9d996',
'hr-rules.js':'f80a02180b51e19818226cdc87a9557645e9b628',
'hr-hours.js':'31f1e75cef84a026be259eee46df4647859da503',
'coexistence.js':'609d0746458b26ddb3cf68b7280c8c86028d9466',
'workers-filter.js':'7bf62ec68233777ca445743f1a6f0d23c18f9c61'};
for(const [name,hash] of Object.entries(expected)){
 const data=fs.readFileSync(path.join(repo,name));
 const actual=crypto.createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
 if(actual!==hash)throw Error('Source version changed: '+name+' '+actual+' (expected '+hash+'). Do not silently change the financial model.');
}
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inline=scripts.filter(x=>!/\bsrc=/.test(x[1]));
if(inline.length!==1||scripts.length!==6||!html.includes('Assumptions &amp; Calculations'))throw Error('Unexpected Four-KPI v3 HTML structure.');
let app=inline[0][2];
if(!/loadDefault\(\);\s*$/.test(app))throw Error('Missing standalone start hook');
app=app.replace(/loadDefault\(\);\s*$/,'');
const scope=s=>s.replace(/\bdocument\.getElementById\s*\(/g,'root.getElementById(').replace(/\bdocument\.querySelectorAll\s*\(/g,'root.querySelectorAll(').replace(/\bdocument\.querySelector\s*\(/g,'root.querySelector(');
app=scope(app);
const overlays=names.map(name=>scope(fs.readFileSync(path.join(repo,name),'utf8'))).join('\n');
const styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]);
if(styles.length<3)throw Error('Expected Four-KPI theme styling not found');
const css=styles.join('\n').replace(/:root\s*\{/g,':host{').replace(/\bhtml\s*\{/g,'.hg-coex-view{').replace(/\bbody\s*\{/g,'.hg-coex-view{')+'\n.pills{flex-wrap:wrap!important;overflow:visible!important;white-space:normal!important}.branch-field{min-width:0}.hg-coex-view{min-height:95vh}';
const sourceBody=html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
if(!sourceBody)throw Error('Dashboard body missing');
const body=sourceBody.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
if(/<script\b/i.test(body)||!body.includes('coexHeadline')){if(/<script\b/i.test(body))throw Error('Script tag in body');}
fs.writeFileSync(path.join(dest,'dashboardMarkup.ts'),'export const DASHBOARD_BODY:string='+JSON.stringify(body)+';\nexport const DASHBOARD_CSS:string='+JSON.stringify(css)+';\n');
const runtime="import * as XLSX from 'xlsx';\nexport function initializeDashboard(workbook,root){\n"+
"if(!XLSX||!XLSX.read)throw Error('XLSX reader unavailable');\n"+
"const metadata=XLSX.read(workbook,{type:'array',bookSheets:true});\n"+
"const required=['Capacity Daily','Employment Months','ADP Approved Dates','Agency Spend','Contract Hours Weekly','Agency CT Source','Weekly Coexistence','Activity Daily Summary'];\n"+
"const missing=required.filter(n=>!metadata.SheetNames.includes(n));\n"+
"if(missing.length)throw Error('The SharePoint workbook is not the Four-KPIs-v3 source workbook. Missing: '+missing.join(', ')+'. Upload the accompanying coexistence-data.xlsx to the secured folder.');\n"+
app+"\n"+overlays+"\nparseWorkbook(workbook.slice(0),'SharePoint: Coexistence Dashboard/coexistence-data.xlsx');\n}\n";
fs.writeFileSync(path.join(dest,'dashboardRuntime.js'),runtime);
console.log('Pinned Four-KPIs-v3 HTML and exact four calculation/worker modules prepared for CSP-safe SPFx bundle.');
