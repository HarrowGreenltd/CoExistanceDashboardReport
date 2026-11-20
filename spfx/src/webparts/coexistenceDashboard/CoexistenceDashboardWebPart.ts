import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { DASHBOARD_BODY, DASHBOARD_CSS } from './dashboardMarkup';
import { initializeDashboard } from './dashboardRuntime';

export interface ICoexistenceDashboardWebPartProps {}
const SITE='https://harrowgreen.sharepoint.com/sites/Managers2';
const FOLDER='/sites/Managers2/Shared Documents/Coexistence Dashboard';
const FILE=FOLDER+'/coexistence-data.xlsx';
const EXPECTED_SHA256='b166ea2e9a456dfaaab0e2ee9f46d7dddfc57bcffd19867a3b4bbc7d38753cfa';
const EXPECTED_BYTES=5876298;
const LINK=SITE+'/Shared%20Documents/Forms/AllItems.aspx?id='+encodeURIComponent(FOLDER);
export default class CoexistenceDashboardWebPart extends BaseClientSideWebPart<ICoexistenceDashboardWebPartProps>{
  private _loadSerial:number=0;
  public render():void{
    this.domElement.innerHTML='<div class="hg-coex-host"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0"><strong style="color:#14879c">Coexistence Dashboard</strong><span>SPFx 1.0.0.11</span><a href="'+LINK+'" target="_blank" rel="noopener noreferrer">Open data folder</a><button class="hg-coex-reload" type="button">Reload data</button></div><div class="hg-coex-status" role="status" aria-live="polite">Loading workbook…</div><div class="hg-coex-dashboard"></div></div>';
    (this.domElement.querySelector('.hg-coex-reload') as HTMLButtonElement).addEventListener('click',()=>void this._load());
    void this._load();
  }
  private _status(message:string,error:boolean=false):void{
    const el=this.domElement.querySelector('.hg-coex-status') as HTMLElement;
    if(el){el.textContent=message;el.style.color=error?'#b91c1c':'#40545d';}
  }
  private async _load():Promise<void>{
    const serial=++this._loadSerial;
    try{
      this._status('Reading SharePoint Coexistence workbook…');
      const host=this.domElement.querySelector('.hg-coex-dashboard') as HTMLElement;if(host)host.style.display='';
      const endpoint=SITE+"/_api/web/GetFileByServerRelativePath(decodedUrl=@file)/$value?@file='"+encodeURIComponent(FILE)+"'&coexRefresh="+Date.now();
      const response=await this.context.spHttpClient.get(endpoint,SPHttpClient.configurations.v1,{headers:{Accept:'application/octet-stream'}});
      if(!response.ok)throw new Error('SharePoint workbook request HTTP '+response.status);
      const workbook=await response.arrayBuffer();
      const sha=Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256',workbook))).map(n=>n.toString(16).padStart(2,'0')).join('');
      const audit='Source '+workbook.byteLength+' bytes · SHA-256 '+sha.slice(0,16)+' · expected '+EXPECTED_BYTES+' bytes / '+EXPECTED_SHA256.slice(0,16);
      if(sha!==EXPECTED_SHA256)throw new Error('Workbook CONTENT mismatch at '+FILE+'. '+audit+'. The app will not show financial results from an unverified data file. Please check the exact SharePoint file, not its name.');
      if(serial!==this._loadSerial)return;
      if(workbook.byteLength<100)throw new Error('Workbook appears empty.');
      const host=this.domElement.querySelector('.hg-coex-dashboard') as HTMLElement;
      if(host.shadowRoot)host.shadowRoot.innerHTML='';
      const shadow=host.shadowRoot||host.attachShadow({mode:'open'});
      const style=document.createElement('style');style.textContent=DASHBOARD_CSS;shadow.appendChild(style);
      const view=document.createElement('div');view.className='hg-coex-view';view.innerHTML=DASHBOARD_BODY;shadow.appendChild(view);
      initializeDashboard(workbook,shadow);
      const branches=shadow.querySelectorAll('#pills button').length;
      const people=shadow.getElementById('peActive')?.textContent||'';
      const jobs=shadow.getElementById('joJobs')?.textContent||'';
      const scope=shadow.getElementById('status')?.textContent||'';
      const pass=branches===10 && Number(people.replace(/,/g,''))>0 && Number(jobs.replace(/,/g,''))>0;
      if(!pass)throw new Error('Live validation failed: workbook bytes MATCH, but dashboard output differs. Branch buttons='+branches+', active people='+people+', jobs='+jobs+'. This points to a SharePoint runtime/caching issue, not the Excel file. Internal status='+scope);
      this._status('Verified matching v3 source · '+audit+' · branch buttons='+branches+' · people='+people+' · jobs='+jobs);
    }catch(error){if(serial===this._loadSerial){const host=this.domElement.querySelector('.hg-coex-dashboard') as HTMLElement;if(host)host.style.display='none';this._status('Dashboard startup failed: '+String(error),true);}}
  }
  protected onDispose():void{this._loadSerial++;super.onDispose();}
}
