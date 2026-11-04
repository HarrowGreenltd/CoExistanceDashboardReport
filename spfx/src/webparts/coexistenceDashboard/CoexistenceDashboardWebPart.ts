
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { DASHBOARD_HTML } from './dashboardMarkup';
export interface ICoexistenceDashboardWebPartProps {}
const SITE='https://harrowgreen.sharepoint.com/sites/Managers2';
const FOLDER='/sites/Managers2/Shared Documents/Coexistence Dashboard';
const FILE=FOLDER+'/coexistence-data.xlsx';
const LINK=SITE+'/Shared%20Documents/Forms/AllItems.aspx?id='+encodeURIComponent(FOLDER);
export default class CoexistenceDashboardWebPart extends BaseClientSideWebPart<ICoexistenceDashboardWebPartProps>{
 private _timer:number|undefined;
 public render():void{
  this.domElement.innerHTML='<div style="font-family:Segoe UI,Arial,sans-serif"><div style="display:flex;align-items:center;justify-content:space-between;gap:9px;padding:10px 0"><strong style="color:#14879c;font-size:18px">Coexistence Dashboard</strong><div><a href="'+LINK+'" target="_blank" rel="noopener noreferrer">Open data folder</a> <button type="button" class="coexistence-reload" style="padding:8px 13px;background:#14879c;color:#fff;border:0;border-radius:7px">Reload data</button></div></div><div class="coexistence-status" role="status" aria-live="polite">Loading data…</div><div class="coexistence-frame"></div></div>';
  (this.domElement.querySelector('.coexistence-reload') as HTMLButtonElement).addEventListener('click',()=>{void this._load()});
  void this._load();
 }
 private _status(text:string,error:boolean=false):void{
  const el=this.domElement.querySelector('.coexistence-status') as HTMLElement;
  if(el){el.textContent=text;el.style.color=error?'#ad3d4a':'#505759'}
 }
 private async _load():Promise<void>{
  try {
   this._status('Reading Shared Documents / Coexistence Dashboard / coexistence-data.xlsx…');
   const endpoint=SITE+"/_api/web/GetFileByServerRelativePath(decodedUrl=@file)/$value?@file='"+encodeURIComponent(FILE)+"'";
   const result=await this.context.spHttpClient.get(endpoint,SPHttpClient.configurations.v1,{headers:{Accept:'application/octet-stream'}});
   if(!result.ok)throw Error('SharePoint HTTP '+result.status+' — check folder spelling and access.');
   const workbook=await result.arrayBuffer();
   if(workbook.byteLength<100)throw Error('The workbook is empty.');
   if(this._timer!==undefined){window.clearInterval(this._timer);this._timer=undefined}
   const host=this.domElement.querySelector('.coexistence-frame') as HTMLDivElement;
   host.innerHTML='';
   const frame=document.createElement('iframe');
   frame.title='Coexistence Dashboard';
   frame.style.cssText='width:100%;height:1400px;border:0;display:block;background:#f4f4f4';
   frame.addEventListener('load',()=>{
     try{
      const win=frame.contentWindow as any;
      win.__HG_Coexistence_SharePoint_File=workbook.slice(0);
      if(typeof win.parseWorkbook!=='function')throw Error('The dashboard script did not load.');
      win.parseWorkbook(workbook.slice(0),'SharePoint: Coexistence Dashboard/coexistence-data.xlsx');
      this._status('Live SharePoint source: Shared Documents / Coexistence Dashboard / coexistence-data.xlsx');
      this._timer=window.setInterval(()=>{
        try{const doc=frame.contentDocument;if(doc&&doc.body)frame.style.height=Math.max(1000,Math.min(18000,doc.body.scrollHeight+60))+'px'}catch(e){}
      },1200);
     }catch(e){this._status('Dashboard startup failed: '+String(e),true)}
   },{once:true});
   frame.srcdoc=DASHBOARD_HTML;
   host.appendChild(frame);
  }catch(e){this._status('SharePoint workbook unavailable: '+String(e),true)}
 }
 protected onDispose():void{
  if(this._timer!==undefined)window.clearInterval(this._timer);
  super.onDispose();
 }
}
