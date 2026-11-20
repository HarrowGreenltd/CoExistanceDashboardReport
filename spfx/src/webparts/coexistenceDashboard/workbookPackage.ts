/* Container-only adaptation: preserve all worksheet XML and financial logic.
   Office/SharePoint can rewrite OOXML relationship order and append custom XML
   while leaving worksheet data untouched. SheetJS 0.18.5 is sensitive to those
   packaging differences in the current controlled workbook. */
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

export interface IWorkbookPackageResult {
  workbook: ArrayBuffer;
  normalized: boolean;
  originalBytes: number;
  normalizedBytes: number;
}
const NS='http://schemas.openxmlformats.org/package/2006/relationships';
function attrs(fragment:string):{[k:string]:string}{
  const result:{[k:string]:string}={};
  const regex=/([A-Za-z]+)="([^"]*)"/g;
  let m:RegExpExecArray|null;
  while((m=regex.exec(fragment))!==null)result[m[1]]=m[2];
  return result;
}
function canonicalRelationships(raw:string):string {
  const list:{[k:string]:string}[]=[];
  const regex=/<Relationship\b([^>]*?)\/>/g;
  let m:RegExpExecArray|null;
  while((m=regex.exec(raw))!==null){
    const a=attrs(m[1]);
    if(!a.Id||!a.Type||!a.Target)continue;
    if(a.Type.toLowerCase().indexOf('customxml')>=0||a.Type.toLowerCase().indexOf('custom-properties')>=0)continue;
    list.push(a);
  }
  const p=(r:{[k:string]:string}):number=>{
    const t=r.Type.toLowerCase();
    if(t.endsWith('/styles'))return 0;
    if(t.endsWith('/theme'))return 1;
    if(t.endsWith('/featurepropertybag'))return 2;
    if(t.endsWith('/sharedstrings'))return 3;
    if(t.endsWith('/worksheet')){
      const mm=/sheet(\d+)\.xml(?:$|\?)/i.exec(r.Target);
      return mm?100+Number(mm[1]):10000;
    }
    return 20000;
  };
  list.sort((a,b)=>p(a)-p(b)||a.Id.localeCompare(b.Id));
  const esc=(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  return '<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="'+NS+'">'+
    list.map(a=>'<Relationship Type="'+esc(a.Type)+'" Target="'+esc(a.Target)+'" Id="'+esc(a.Id)+'" />').join('')+
    '</Relationships>';
}
export function normalizeWorkbookPackage(input:ArrayBuffer):IWorkbookPackageResult {
  const originalBytes=input.byteLength;
  const files=unzipSync(new Uint8Array(input));
  const relName='xl/_rels/workbook.xml.rels';
  const rel=files[relName];
  if(!rel||!files['xl/workbook.xml'])throw new Error('The SharePoint workbook is missing its Excel package relationships.');
  const rawRel=strFromU8(rel);
  const canonical=canonicalRelationships(rawRel);
  if(canonical.indexOf('/worksheet"')<0&&canonical.indexOf('/worksheet')<0)throw new Error('No Excel worksheets were found in the workbook relationships.');
  let metadataChanged=rawRel.replace(/^\uFEFF/,'').trim()!==canonical;
  const rootRel='_rels/.rels';
  if(files[rootRel]){
    const rawRoot=strFromU8(files[rootRel]);
    const normalizedRoot=canonicalRelationships(rawRoot);
    if(rawRoot.replace(/^\uFEFF/,'').trim()!==normalizedRoot)metadataChanged=true;
    files[rootRel]=strToU8(normalizedRoot);
  }
  files[relName]=strToU8(canonical);
  for(const name of Object.keys(files)){
    if(name.indexOf('customXml/')===0||name.indexOf('[trash]/')===0||name==='docProps/custom.xml'){
      delete files[name];metadataChanged=true;
    }
  }
  if(!metadataChanged)return{workbook:input,normalized:false,originalBytes,normalizedBytes:originalBytes};
  // The ZIP container is rebuilt, but every sheet and shared-string byte remains unchanged.
  const rebuilt=zipSync(files,{level:6});
  const workbook=rebuilt.buffer.slice(rebuilt.byteOffset,rebuilt.byteOffset+rebuilt.byteLength) as ArrayBuffer;
  return{workbook,normalized:true,originalBytes,normalizedBytes:workbook.byteLength};
}
