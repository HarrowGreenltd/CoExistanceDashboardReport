# Harrow Green — HR-confirmed Deployment Discipline Dashboard

Version: 16 November 2026. Restricted HR/operations data. Activity coverage: 1 January–31 October 2026; agency spending coverage: 44 weeks through 8 November 2026.

## Open the dashboard

Keep `index.html`, `hr-rules.js` and `coexistence-data.xlsx` in the **same private directory** and open `index.html` from a private HTTP(S) host. The browser reads `coexistence-data.xlsx` alongside the page. A manual workbook upload remains available. The page loads its spreadsheet reader from jsDelivr, so internet access to that script is needed.

**Do not publish these files to a public GitHub repository or public GitHub Pages site.** They contain employee identities, HR join/leaving dates and ADP-approved absence dates. Apply suitable access controls and retention requirements.

## Confirmed calculation decisions

1. **Employment dates:** A person is considered employed for their entire HR joining month, unless an HR end date falls within it. An HR leaving date truncates the last month on that exact date. If no dated HR tenure is available, the original 0/1 monthly employment flag is the fallback. HR-dated records take precedence when flags contradict them.
2. **Availability:** Every calendar day, including weekends, counts as one available person-day for each eligible *fixed* colleague, irrespective of contracted hours or shifts. This is a user-directed modelling convention, **not payroll FTE or contracted-hours capacity**.
3. **Leave precedence:** An approved ADP absence date removes one available person-day. Diary annual-leave entries are not accepted as authoritative. Multi-day ADP entries are expanded to calendar dates. Partial-day hours are not prorated; work recorded on approved absence is retained as a conflict and excluded from the utilisation numerator.
4. **Daily fixed-person utilisation:** Distinct, identified fixed-person worked dates (that are eligible and not ADP absence dates) ÷ the corresponding net available fixed-person days. Both are calculated over the selected activity date range and by home branch. A customer-mode filter changes which worked dates count, but it does not change HR employment or approved ADP availability.
5. **Agency spend:** The nine branch costings from the finance report are summed per week with an Excel formula. The national hardcoded value is retained as an audit comparator. Agency spend is shown for its own accounting coverage and **does not follow the activity date filter**.
6. **Cost exposure:** The old June financial model remains accessible as historic source data, but savings, avoidable agency cost and coexistence exposure **remain unverified**, not headline financial claims.

## Source-backed reconciliation

| Check | Reconciled result |
| --- | ---: |
| Gross fixed-person calendar days | 53,821 |
| ADP absence dates on eligible fixed roster | 4,845 |
| Net available fixed-person days | **48,976** |
| ADP-approved source records | 3,128 |
| Distinct ADP-approved person-dates | 7,357 |
| Monthly employment flags overridden by dated HR tenure | 45 |
| Roster employee IDs requiring monthly 0/1 fallback | 25 |
| Work/ADP absence conflicts | 74 |
| Unmatched permanent worked records excluded from the fixed-person numerator | 201 |
| Unmatched agency/external worked records (not used in fixed numerator) | 8,210 |
| Agency spending weeks with a difference from hardcoded national total | 13 of 44 |
| Selected formula-driven agency spend | **£1,418,949.66** |
| Original hardcoded national agency spend | £1,389,181.58 |
| Hardcoded national less selected formula total | **−£29,768.08** |

These are data-model checks, not a statement that the underlying HR or booking records have all been verified with their owners. In particular, *no recorded work* does not demonstrate that a colleague was operationally available, suitably skilled or substitutable for agency labour.

## Integrity and test status

- Independent workbook read-back established the daily 53,821 / 4,845 / 48,976 totals and the cached Excel agency formula sum.
- An isolated dashboard logic test passed for the 48,976-day denominator, 4,584 October-day denominator, period filter, HR/ADP exception counts, identity exclusions, and the safeguard withholding financial exposure.
- The earlier dashboard integrity regression test also passed.
- Full headless Chromium testing **could not complete** in this execution environment because browser process creation was blocked; a visual and interactive acceptance run remains required on a permitted machine before deployment.
- The dashboard includes a visible HR and data-integrity panel listing outstanding exceptions.

## Next controlled review

Validate the 201 unidentified permanent work records, 74 work/ADP absence conflicts, 25 fallback staff records and 13 agency financial differences against HR, Operations and Finance owners. Resolve the 22 ambiguous worked identity matches before treating person-level figures as final. Confirm that the seven-day capacity convention remains useful for the intended executive KPI.

The workbook includes `Decision Log`, `HR Register`, `Employment Months`, `ADP Approved Dates`, `Capacity Daily`, `Activity Daily Summary` and `Agency Spend` for source tracing. It deliberately excludes NI numbers, birth dates and salaries.
