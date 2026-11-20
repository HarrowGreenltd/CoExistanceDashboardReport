# v1.0.0.11 — targeted tenant-data diagnostics
Screenshots show the v1.0.0.10 browser test parity cannot be reproduced in the SharePoint tenant. This version does NOT change a single source financial calculation rule.

Before showing results it verifies the SHA-256 digest of the workbook downloaded from the actual Managers2 SharePoint path against the exact v3 workbook used in browser acceptance. Expected 5,876,298 bytes, SHA-256 b166ea2e9a456dfaaab0e2ee9f46d7dddfc57bcffd19867a3b4bbc7d38753cfa. Uses cache-busting query. If bytes differ the dashboard displays a clear failure and stops showing financial totals. If bytes match but zero/blank branch/people/job controls occur, the dashboard displays a distinct runtime issue with output counts. This prevents false financial reporting and indicates which cause to investigate.

Confirmed earlier: source-level Playwright acceptance of v1.0.0.10 achieved all 10 branch buttons, 652 people, 3445 jobs, and two exact cost-method reference totals. Those results were not from a tenant/live installed package. This diagnostic version still needs live tenant acceptance. No change to GitHub main or production tenant.
