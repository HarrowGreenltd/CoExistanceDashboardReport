import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { DASHBOARD_BODY, DASHBOARD_CSS } from './dashboardMarkup';
import { initializeDashboard } from './dashboardRuntime';
import { normalizeWorkbookPackage } from './workbookPackage';

export interface ICoexistenceDashboardWebPartProps {}
const SITE='https://harrowgreen.sharepoint.com/sites/Managers2';
const FOLDER='/sites/Managers2/Shared Documents/Coexistence Dashboard';
const FILE=FOLDER+'/coexistence-data.xlsx';
const LINK=SITE+'/Shared%20Documents/Forms/AllItems.aspx?id='+encodeURIComponent(FOLDER);
export default class CoexistenceDashboardWebPart extends BaseClientSideWebPart<ICoexistenceDashboardWebPartProps>{
  private _loadSerial:number=0;
  public render():void{
    this.domElement.innerHTML='<div class="hg-coex-host"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0"><strong style="color:#14879c">Coexistence Dashboard</strong><span>SPFx 1.0.0.12</span><a href="'+LINK+'" target="_blank" rel="noopener noreferrer">Open data folder</a><button class="hg-coex-reload" type="button">Reload data</button></div><div class="hg-coex-status" role="status" aria-live="polite">Loading workbook…</div><div class="hg-coex-dashboard"></div></div>';
    (this.domElement.querySelector('.hg-coex-reload') as HTMLButtonElement).addEventListener('click',()=>void this._load());
    void this._load();
  }
  private _status(message:string,error:boolean=false):void{
    const el=this.domElement.querySelector('.hg-coex-status') as HTMLElement;
    if(el){el.textContent=message;el.style.color=error?'#b91c1c':'#40545d';}
  }
  private async _load():Promise<void>{
    const serial=++this._loadSerial;
    const host=this.domElement.querySelector('.hg-coex-dashboard') as HTMLElement;
    if(host)host.style.display='';
    try{
      this._status('Reading and validating SharePoint workbook…');
      const endpoint=SITE+"/_api/web/GetFileByServerRelativePath(decodedUrl=@file)/$value?@file='"+encodeURIComponent(FILE)+"'&coexRefresh="+Date.now();
      const response=await this.context.spHttpClient.get(endpoint,SPHttpClient.configurations.v1,{headers:{Accept:'application/octet-stream'}});
      if(!response.ok)throw new Error('SharePoint workbook request HTTP '+response.status);
      const input=await response.arrayBuffer();
      if(serial!==this._loadSerial)return;
      if(input.byteLength<100)throw new Error('Workbook appears empty.');
      const prep=normalizeWorkbookPackage(input);
      if(serial!==this._loadSerial)return;
      const dashboardHost=this.domElement.querySelector('.hg-coex-dashboard') as HTMLElement;
      if(dashboardHost.shadowRoot)dashboardHost.shadowRoot.innerHTML='';
      const shadow=dashboardHost.shadowRoot||dashboardHost.attachShadow({mode:'open'});
      const style=document.createElement('style');style.textContent=DASHBOARD_CSS;shadow.appendChild(style);
      const view=document.createElement('div');view.className='hg-coex-view';view.innerHTML=DASHBOARD_BODY;shadow.appendChild(view);
      initializeDashboard(prep.workbook,shadow);
      // Fail closed: partial DOM data previously produced materially incorrect costs.
      const branches=shadow.querySelectorAll('#pills button').length;
      const people=Number((shadow.getElementById('peActive')?.textContent||'').replace(/,/g,''));
      const jobs=Number((shadow.getElementById('joJobs')?.textContent||'').replace(/,/g,''));
      const trend=Boolean(shadow.getElementById('weeklyTrendChart')?.querySelector('svg'));
      const errors=shadow.getElementById('error')?.textContent||'';
      if(branches!==10||!(people>0)||!(jobs>0)||!trend||errors){
        throw new Error('Live source validation failed: '+branches+' branch choices, '+people+' active workers, '+jobs+' jobs, CT trend='+trend+
          (errors?', dashboard error: '+errors:'')+
          '. Source '+prep.originalBytes+' bytes; package-normalized='+prep.normalized+'. Financial results withheld.');
      }
      this._status('Validated SharePoint workbook · '+prep.originalBytes+' bytes'+(prep.normalized?' · Excel package metadata normalised in memory':' · original package already compatible')+' · 9 branches · '+people+' workers · '+jobs+' jobs');
    }catch(error){
      if(serial!==this._loadSerial)return;
      if(host)host.style.display='none';
      this._status('Coexistence data validation failed: '+String(error),true);
    }
  }
  protected onDispose():void{this._loadSerial++;super.onDispose();}
}
