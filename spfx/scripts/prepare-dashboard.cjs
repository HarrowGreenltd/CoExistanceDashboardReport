'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'src/webparts/coexistenceDashboard');
const html=fs.readFileSync(path.join(root,'dashboard-source.html'),'utf8');
const overlay=fs.readFileSync(path.join(root,'hr-rules-source.js'),'utf8');
if(!html.includes('Current safeguards')||!html.includes('coexistence-data.xlsx'))throw Error('The latest pinned GitHub dashboard is missing');
if(!overlay.includes('Capacity Daily')||!overlay.includes('Employment Months')||!overlay.includes('ADP Approved Dates')||!overlay.includes('Agency Spend'))throw Error('Missing HR/agency source overlay');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inline=scripts.filter(x=>!/\bsrc=/.test(x[1]));
if(inline.length!==1||scripts.length!==3||!scripts.some(x=>/hr-rules\.js/.test(x[1])))throw Error('Unexpected GitHub dashboard scripts');
let app=inline[0][2];
if(!/loadDefault\(\);\s*$/.test(app))throw Error('Unexpected GitHub dashboard startup hook');
app=app.replace(/loadDefault\(\);\s*$/,'');
const scope=s=>s.replace(/\bdocument\.getElementById\s*\(/g,'root.getElementById(').replace(/\bdocument\.querySelectorAll\s*\(/g,'root.querySelectorAll(').replace(/\bdocument\.querySelector\s*\(/g,'root.querySelector(');
app=scope(app);
const hrCode=scope(overlay);
const styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]);
if(!styles.length)throw Error('GitHub dashboard styles missing');
const css=styles.join('\n').replace(/:root\s*\{/g,':host{').replace(/\bbody\s*\{/g,'.hg-coex-view{')+'\n.pills{flex-wrap:wrap!important;overflow:visible!important;white-space:normal!important}.field.branch-field{min-width:0}';
const body=html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
if(!body)throw Error('Dashboard body missing');
const cleaned=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
if(/<script\b/i.test(cleaned))throw Error('Inline scripts still in rendered markup');
fs.writeFileSync(path.join(dest,'dashboardMarkup.ts'),'export const DASHBOARD_BODY:string='+JSON.stringify(cleaned)+';\nexport const DASHBOARD_CSS:string='+JSON.stringify(css)+';\n');
const runtime="import * as XLSX from 'xlsx';\nexport function initializeDashboard(workbook,root){\n"+
"if(!XLSX||!XLSX.read)throw new Error('The Excel workbook reader did not initialise');\n"+
"const book=XLSX.read(workbook,{type:'array',bookSheets:true});\n"+
"const required=['Capacity Daily','Employment Months','ADP Approved Dates','Agency Spend'];\n"+
"const missing=required.filter(n=>!book.SheetNames.includes(n));\n"+
"if(missing.length)throw new Error('The published workbook does not include GitHub parity data sheets: '+missing.join(', ')+'. Please publish a validated workbook containing these sheets; reporting cannot be treated as equivalent without them.');\n"+
app+"\n"+hrCode+"\nparseWorkbook(workbook.slice(0),'SharePoint: Coexistence Dashboard/coexistence-data.xlsx');\n}\n";
fs.writeFileSync(path.join(dest,'dashboardRuntime.js'),runtime);
console.log('Pinned live GitHub dashboard and HR overlay compiled into SPFx runtime; required sheet validation enabled.');
