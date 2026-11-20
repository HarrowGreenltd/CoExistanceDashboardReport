'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const {unzipSync,zipSync,strToU8,strFromU8}=require('fflate');
const XLSX=require('xlsx');
const root=path.resolve(__dirname,'..'),source=path.resolve(root,'..');
const mod={exports:{}};
const s=fs.readFileSync(path.join(root,'src/webparts/coexistenceDashboard/workbookPackage.ts'),'utf8');
const code=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
new Function('require','module','exports',code)(require,mod,mod.exports);
const {normalizeWorkbookPackage}=mod.exports;
const bytes=fs.readFileSync(path.join(source,'coexistence-data.xlsx'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function officeRepack(original){
 const files=unzipSync(new Uint8Array(original)),rel='xl/_rels/workbook.xml.rels';
 const xml=strFromU8(files[rel]),parts=[...xml.matchAll(/<Relationship\b[^>]*\/>/g)].map(x=>x[0]);
 assert(parts.length>21);
 files[rel]=strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+parts.reverse().join('')+'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item1.xml"/></Relationships>');
 files['customXml/item1.xml']=strToU8('<item>Office metadata</item>');
 files['[trash]/0000.dat']=strToU8('extra');
 return zipSync(files,{level:6});
}
function validate(){
 const office=officeRepack(bytes),sample=office.buffer.slice(office.byteOffset,office.byteOffset+office.byteLength),fixed=normalizeWorkbookPackage(sample);
 assert(fixed.normalized,'Office packaging should trigger normalisation');
 const original=unzipSync(new Uint8Array(bytes)),rebuilt=unzipSync(new Uint8Array(fixed.workbook));
 const core=Object.keys(original).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)||['xl/workbook.xml','xl/sharedStrings.xml','xl/styles.xml'].includes(n));
 assert.equal(core.length,24);
 for(const name of core)assert.equal(sha(rebuilt[name]),sha(original[name]),'Cell/worksheet change in '+name);
 assert(!Object.keys(rebuilt).some(n=>n.startsWith('customXml/')||n.startsWith('[trash]/')));
 const wb=XLSX.read(fixed.workbook,{type:'array',bookSheets:true});assert.equal(wb.SheetNames.length,21);
 console.log('OOXML normalisation PASSED: 21 worksheets and their HR/finance/activity bytes unchanged');
}
if(require.main===module)validate();
exports.officeRepack=officeRepack;