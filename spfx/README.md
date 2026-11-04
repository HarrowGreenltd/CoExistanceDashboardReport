# Harrow Green Coexistence Dashboard — SharePoint Online

SPFx 1.21.1 source project, supported with Node 22.

Correct SharePoint file location (never "CoExistance"):
/sites/Managers2/Shared Documents/Coexistence Dashboard/coexistence-data.xlsx

Build:
  npm install --no-audit --no-fund
  npm run prepare-dashboard
  npm run build

Install the resulting sharepoint/solution/harrowgreen-coexistence-dashboard.sppkg in SharePoint App Catalog, then add **Coexistence Dashboard** web part to the Managers2 SitePages app page.

The web part fetches workbook bytes with authenticated SPHttpClient, embeds the pinned existing dashboard HTML into a same-origin srcdoc iframe, and passes the workbook to its parser. The data is not posted to GitHub or CDN. The pinned app code includes "Generate File"; download the resulting consolidated coexistence-data.xlsx and upload it to the same folder. Finance and contractual capacity cannot be inferred from raw Forecaster exports.

GitHub's legacy spelling appears only in the upstream source repository URL; the SharePoint folder and file paths use Coexistence.
