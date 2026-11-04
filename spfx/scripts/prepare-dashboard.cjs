
'use strict';
const fs=require('node:fs'),path=require('node:path');
const SHA='ddc3a2a2361f8001d643b47262e3f4435a38f3c0';
const RAW='https://raw.githubusercontent.com/HarrowGreenltd/CoExistanceDashboardReport/'+SHA+'/index.html';
const XLSX='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
async function get(url){const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status+' '+url);return r.text()}
(async()=>{
 let html=await get(RAW);
 if(!html.includes('generateForecasterFile')||!html.includes('coexistence-data.xlsx'))throw Error('Wrong dashboard revision');
 const lib=await get(XLSX);
 if(lib.length<100000)throw Error('Spreadsheet reader download failed.');
 const tag=/<script\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js["']\s*><\/script>/i;
 if(!tag.test(html))throw Error('Expected XLSX script tag missing.');
 html=html.replace(tag,'<script>'+lib.replace(/<\/script/gi,'<\\/script')+'</script>');
 const startup=/\nloadDefault\(\);\s*\n<\/script>/;
 if(!startup.test(html))throw Error('Dashboard startup hook changed.');
 html=html.replace(startup,'\n/* Loaded by SharePoint SPFx host */\n</script>');
 const shim=[
 '<script>','(function(){','var original=window.fetch.bind(window);',
 'window.fetch=function(input,options){',
 'var url=typeof input==="string"?input:(input&&input.url)||"";',
 'if(/^(?:\\.\\/)?coexistence-data\\.xlsx(?:[?#]|$)/i.test(url)){',
 'var data=window.__HG_Coexistence_SharePoint_File;',
 'if(!data)return Promise.reject(new Error("SharePoint Coexistence workbook not loaded."));',
 'return Promise.resolve(new Response(data.slice(0),{status:200,headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}}));',
 '}','return original(input,options);','};','})();','</script>'
 ].join('\n');
 if(!html.includes('</head>'))throw Error('Dashboard document head not found.');
 html=html.replace('</head>',shim+'\n</head>');
 const target=path.resolve(__dirname,'../src/webparts/coexistenceDashboard/dashboardMarkup.ts');
 fs.writeFileSync(target,'export const DASHBOARD_HTML:string='+JSON.stringify(html)+';\n');
 console.log('Embedded pinned Coexistence dashboard ('+html.length+' characters).');
})().catch(e=>{console.error(e);process.exitCode=1});
