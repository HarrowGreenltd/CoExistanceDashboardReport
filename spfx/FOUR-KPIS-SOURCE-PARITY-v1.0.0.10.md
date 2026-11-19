# SharePoint Four-KPI source-parity repair 1.0.0.10
This is a direct port of the existing pinned Four KPI v3 workbook and scripts. It does not change the HR, cost, agency, branch, date, threshold, worker or utilisation rules.

Cause identified: the previous packager rewrote document.getElementById/querySelector/querySelectorAll to root equivalents. The original financial update() declares a local variable called root, so the textual rewrite could point lookups at the wrong element and break rendering.

Repair: Preserve original GitHub script bytes, place a local facade named document inside initializeDashboard, with selectors bound to the web part ShadowRoot and createElement delegated to the host document. This avoids any lexical name collisions and SharePoint CSP blocks without changing the original model logic.

Acceptance: automated headless Chromium test against the exact bundled source workbook checks 10 branch buttons, detailed people and jobs, calendar, CT charts, four financial headline figures, both utilisation basis totals and branch switching. Installation in the tenant remains a separate acceptance step. The SharePoint workbook must be the matching v3 coexistence-data.xlsx.
