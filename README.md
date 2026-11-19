# Harrow Green | Coexistence Dashboard — Four-KPI Workforce Release

**Updated 19 November 2026. Confidential HR, employee absence, operational deployment and financial information. PRIVATE HOSTING ONLY.**

## What this version measures

The financial analysis is based on one **branch and complete CT-costed work week**. Unit count supplies **agency deployment hours and person-days**; CT supplies **independently billed hours and agency cost**. They are not identical. Where permanent contracted hours remain unused in the same branch/week as agency deployment, the model allocates the smaller hour quantity as matched overlap.

The overview contains **four non-additive headline cards**, each with relevant money, hours and nine-hour-day equivalents. Descriptions are deliberately short; each card has a hover/focus explanation. The **Assumptions & Calculations** tab carries the formulas, supporting cost allocations, source reconciliation and caveats:

1. **Underutilised permanent capacity:** all unused permanent hours × the historical branch hourly proxy (plus hours and nine-hour-day equivalents).
2. **Agency expenditure:** full CT billed spend (including non-hourly adjustments), with unit-count agency recorded hours and actual agency person-days. CT billed hours appear in the reconciliation panel.
3. **Coexistence cost:** modelled agency cost allocated to matched agency deployment hours **plus** historical permanent cost on the corresponding unused permanent hours. The agency portion is labelled potential reduction, not achieved savings.
4. **Other permanent underutilisation:** card 1 minus the **permanent-only portion** of card 3; hours and days follow the same subtraction.

**Total identified labour cost exposure** = all unused permanent capacity cost proxy + matched agency expenditure. It appears as a visible equation below the four cards, with pence shown so rounding cannot obscure the reconciliation. A second check shows that it also equals the overlapping labour cost plus the other unused permanent cost. The agency reduction opportunity appears in this bridge, rather than as a second large number inside card 3.

* **Matched-hour coexistence cost** = costed CT agency expenditure on overlapping **unit-count** deployment hours **plus** historical permanent hourly cost proxy on **the same overlapping permanent hours**. The priced agency component is capped by CT's hourly cost for the branch/week.
* **Potentially avoidable agency** = matched agency hourly cost. An opportunity indication, **not** verified savings.
* **Capacity-unmatched agency (provisionally structural)** = remaining CT hourly agency spend after matching. Does not establish that use was justified or operationally necessary.
* **Other permanent underutilisation** = unused permanent hours not included in matched overlap, valued separately using historical branch cost-rate proxies.
* **Non-hourly CT adjustments** remain a separate category and are not misclassified as matched or structural agency.

Do not sum the coexistence KPI with total agency spend or total permanent-underutilisation proxy: they contain overlapping components. A financial opportunity is a modelled signal; it cannot establish that permanent employees were available with the right skills, at the right location and time, or that agency hours could actually be removed.

## Files

* `index.html`: dashboard shell, branch/people/calendar/customer drill-down and refresh UI.
* `hr-rules.js`: approved HR identity, employment and absence rules.
* `hr-hours.js`: evidenced weekly contract hours, 45-hour fallback and selected-period utilisation.
* `coexistence.js`: strict branch-week coexistence cost model, four headline cards, agency source reconciliation, CSV export and **single-selector utilisation basis**. Defaults to a nine-hour deployed person-day; can switch to recorded actual hours.
* `workers-filter.js`: worker-category filter for activity drill-downs and **A** badges for agency/external individuals. It deliberately does not alter the agency expenditure or permanent capacity headlines.
* `coexistence-data.xlsx`: full original controlled source workbook, **unchanged** in this rebuild. **Its previous `Coexistence Model` worksheet retains the historical wider-exposure methodology** and must not be mistaken for the Version 3 cost headline.
* `README.md`: this release guide. The earlier dual-basis Excel audit file used **CT hours as its matching input** and therefore does **not** reproduce the four-KPI dashboard's revised unit-count matching figures. Do not use it as the current financial control.

## Deployment

Place the **six** runtime files (`index.html`, `hr-rules.js`, `hr-hours.js`, `coexistence.js`, `workers-filter.js`, `coexistence-data.xlsx`) in the same authenticated HTTPS folder and open `index.html`. The browser loads SheetJS from jsDelivr. The original six tabs are retained: Overview, Branches, People, Individual, Jobs & Customers, Refresh Data; the new **Assumptions & Calculations** tab is added between Jobs & Customers and Refresh Data. Alternatively open `HG_Coexistence_Dashboard_Four_KPIs_Single_File.html` in a browser with access to jsDelivr; the source workbook is embedded.

**Never deploy this employee-level workbook on public GitHub Pages or in a public GitHub repository.** Even an unlinked spreadsheet can be directly downloaded when hosted publicly. Use authenticated access and private file serving, or replace identifiable employee records with an approved aggregated dataset.

A fully controlled refresh requires a reprocessed and reconciled `coexistence-data.xlsx`, not a partially staged raw forecaster, CT or ADP file. The manual workbook selector is retained for private use.

## Reference reconciliation: 41 complete costed work weeks to 18 October 2026

| Measure | Deployed days × 9h (default) | Recorded actual hours |
| --- | ---: | ---: |
| Branch-weeks covered | 369 | 369 |
| Branch-weeks with positive matched hours | 246 | 256 |
| Total CT billed cost including non-hourly entries | £1,358,850.50 | £1,358,850.50 |
| Agency person-days from unit-count activity | 8,019 | 8,019 |
| Unit-count recorded agency deployment hours | 72,151.71 h | 72,151.71 h |
| CT billed hourly agency units | 69,503.78 h | 69,503.78 h |
| **Net deployment – billed hour difference** | **+2,647.93 h** | **+2,647.93 h** |
| Potential agency spend reduction opportunity | £480,001.62 | £488,912.37 |
| Matched spare permanent hours | 26,322.22 h | 26,953.38 h |
| Matched permanent cost proxy | £224,296.81 | £230,237.31 |
| **Matched-hour coexistence cost proxy** | **£704,298.43** | **£719,149.68** |
| Other unused permanent cost proxy | £242,046.88 | £286,176.73 |
| **Total inefficiency exposure proxy** | **£946,345.32** | **£1,005,326.42** |
| Total unused permanent hours | 50,317.03 h | 56,339.33 h |
| **All unused permanent cost proxy** | **£466,343.70** | **£516,414.04** |

Source CT work-week costs end **18 October 2026**. Operational records extend through 31 October 2026 and the separate formula-derived agency spend controls through 8 November 2026. The periods **must not be silently combined**. For date selections entirely after the CT coverage the financial KPIs say **No CT data**, not £0; selections spanning covered and uncovered weeks show partial coverage.

## Filter behaviour

- **Branch** changes cost, activity and people views to the selected branch.
- **From/To** selects costed weeks by **week-ending date**. A partial calendar week must not be priced as a full week without qualification.
- **Agency threshold (hours/week)** applies to **unit-count agency deployment hours** in each branch-week (default 0); it changes matched vs unmatched allocation but not original CT billed cost.
- **Utilisation calculation basis** is one selector shared by the financial cost model and deployment utilisation: default **Deployed days × 9 hours** (a qualifying permanent employee-date with any positive recorded hours uses a full nine-hour slot), or **Recorded actual hours**. Weekly available capacity retains the source contracted-hour and approved-leave rules under both methods.
- **Customer mode** filters recorded diary jobs/hours. The CT cost source does **not** provide confirmed customer attribution. Therefore the financial allocation is independent of HG/RHG display mode; HG/RHG-only cost cards show `n.a.` rather than falsely allocating supplier costs to internal references.
- **Search** filters detailed recorded activity, not branch/week CT costs.
- **Workforce records** toggles **Permanent + agency / Exclude agency / Agency only** in branch, people, individual and job/customer activity drill-downs. People and individual views mark agency/external workers with an **A**. This display control intentionally leaves the four financial KPIs unchanged. Agency billings do not have a verified person-by-person rate allocation.
- **Agency deployment vs billed hours** exposes the unit-count/CT variance by branch-week and exports every selected covered branch-week as CSV. The difference may reflect billing basis, rate period, hours definitions or time recording and must be checked, not automatically called an overcharge.
- **Cost model information** is concentrated on the Assumptions & Calculations tab, including the agency-spend allocation and permanent-underutilisation breakdown previously shown under the Overview.
- **Reset** restores the threshold to zero as well as regular view filters.

## Acceptance and limits

The revised reference values above are independently recalculated from the embedded source workbook by `verify_four_kpis.py` (in the source ZIP). Unit-count agency hours reconcile to its daily activity records, while CT billed hours differ by **2,647.93 hours**. The present release passed script syntax, arithmetic and a direct runtime check of the *actual headline KPI updater*, including its currency formatting and reconciliation bridge. **Full visual browser acceptance remains unverified** because the available Chromium instance cannot create its process socket.

Open HR, CT and operations exceptions remain (e.g. mismatched IDs, HR tenure violations, ADP conflict dates, provisional CT branch mappings and historical permanent rate calibration). None was silently corrected in this presentation/model rebuild. Strict overlap does not verify employee role/skill, shift, travel or customer-specific substitution. The result is modelled exposure, not proven avoidable expenditure or cash savings.

## Release change log

**V3 / 17 Nov 2026:** Replaced the V2 broad coexistence-week £952,399 headline with a strict matched-hour £758,898 headline. Added a separate agency cost allocation (potential £523,257; capacity-unmatched £826,394; adjustments £9,199), matched-vs-other permanent underutilisation, branch allocation table, priority branch-week queue, dynamic threshold, and a standalone formula-driven source-audit workbook. Existing activity, calendars and source data retained.

**18 Nov 2026: deployment-day calculation option and audit workbook.** The HTML defaults to **Deployed days × 9 hours**, with one qualifying permanent employee-date treated as nine deployed hours regardless of recorded job hours. A single filter switches back to **Recorded actual hours**. Both use the same HR-contracted capacity, employment dates and approved ADP-leave adjustments; weekly branch agency-cost matching is recalculated on the selected basis. The dual-basis Excel model is now included. This comparison is a planning assumption, not evidence that a scheduled nine-hour day was fully productive or that matched agency can be removed without service impact.

**19 Nov 2026: four KPI cards, unit-count matching and agency worker drill-down.** Replaced CT invoice-hour matching with **unit-count agency deployment-hour matching** and capped cost attribution at actual CT hourly spend. Added underutilised permanent cost, agency spend, coexistence and other underutilisation with volume equivalents, total inefficiency strip, branch-week billing differences and CSV export. Retained all drill-down tabs and added agency worker inclusion filter and **A** markers. Previous V3 and 18 November model figures are historical and are **not** comparable on an unchanged method basis.

**19 Nov 2026: simplified cost communication.** Replaced dense card explanations with plain English and information buttons, moved the potential agency reduction into a visible cost bridge, and renamed the aggregate **Total identified labour cost exposure**. The primary bridge uses exact pennies to avoid presenting a £1 mismatch from independently rounded values. Added a new Assumptions & Calculations tab containing the full component reconciliation, source assumptions, CT/unit-count differences and two detailed breakdowns. The model inputs and business rules did not change in this presentation revision.

**19 Nov 2026: KPI validation display repair.** Corrected a currency formatter invocation in the new headline cost bridge that could interrupt the financial updater and leave all headline costs marked **Not validated** even after the controlled workbook loaded. Rendering failures are now reported separately from source-data validation failures, so a display error cannot itself demote reconciled model data. Added a direct updater regression test. **No source workbook data or underlying financial calculations were changed.**
