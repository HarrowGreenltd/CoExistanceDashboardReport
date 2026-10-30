CP Co-existence Dashboard — GitHub upload package

Upload both files to the root of your GitHub Pages repository:

1. index.html
2. coexistence-data.xlsx

The HTML reads the workbook directly in the browser.
For future updates, replace only coexistence-data.xlsx with the latest workbook,
keeping exactly the same filename.

No seeded or demonstration data is embedded in index.html.

For a workbook over GitHub's web-upload limit, run:
`./split-coexistence-workbook.ps1 -WorkbookPath "C:\path\to\coexistence-data.xlsx" -OutputFolder "C:\path\to\parts"`

Upload the generated `coexistence-data.manifest.json` and every `coexistence-data.part001`, `part002`, and so on to this repository root. The dashboard joins the parts in the browser before reading the original workbook. The script uses 20 MB parts, below GitHub's 25 MB web-upload limit.
