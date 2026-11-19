import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { DASHBOARD_BODY, DASHBOARD_CSS } from './dashboardMarkup';
import { initializeDashboard } from './dashboardRuntime';

export interface ICoexistenceDashboardWebPartProps {}
const SITE='https://harrowgreen.sharepoint.com/sites/Managers2';
const FOLDER='/sites/Managers2/Shared Documents/Coexistence Dashboard';
const FILE=FOLDER+'/coexistence-data.xlsx';
const LINK=SITE+'/Shared%20Documents/Forms/AllItems.aspx?id='+encodeURIComponent(FOLDER);
export default class CoexistenceDashboardWebPart extends BaseClientSideWebPart<ICoexistenceDashboardWebPartProps>{
  private _loadSerial:number=0;
  public render():void{
    this.domElement.innerHTML='<div class="hg-coex-host"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0"><strong style="color:#14879c">Coexistence Dashboard</strong><span>SPFx 1.0.0.10</span><a href="'+LINK+'" target="_blank" rel="noopener noreferrer">Open data folder</a><button class="hg-coex-reload" type="button">Reload data</button></div><div class="hg-coex-status" role="status" aria-live="polite">Loading workbook…</div><div class="hg-coex-dashboard"></div></div>';
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
      const endpoint=SITE+"/_api/web/GetFileByServerRelativePath(decodedUrl=@file)/$value?@file='"+encodeURIComponent(FILE)+"'";
      const response=await this.context.spHttpClient.get(endpoint,SPHttpClient.configurations.v1,{headers:{Accept:'application/octet-stream'}});
      if(!response.ok)throw new Error('SharePoint workbook request HTTP '+response.status);
      const workbook=await response.arrayBuffer();
      if(serial!==this._loadSerial)return;
      if(workbook.byteLength<100)throw new Error('Workbook appears empty.');
      const host=this.domElement.querySelector('.hg-coex-dashboard') as HTMLElement;
      if(host.shadowRoot)host.shadowRoot.innerHTML='';
      const shadow=host.shadowRoot||host.attachShadow({mode:'open'});
      const style=document.createElement('style');style.textContent=DASHBOARD_CSS;shadow.appendChild(style);
      const view=document.createElement('div');view.className='hg-coex-view';view.innerHTML=DASHBOARD_BODY;shadow.appendChild(view);
      initializeDashboard(workbook,shadow);
      this._status('Live SharePoint source: Coexistence Dashboard/coexistence-data.xlsx');
    }catch(error){if(serial===this._loadSerial)this._status('Dashboard startup failed: '+String(error),true);}
  }
  protected onDispose():void{this._loadSerial++;super.onDispose();}
}
