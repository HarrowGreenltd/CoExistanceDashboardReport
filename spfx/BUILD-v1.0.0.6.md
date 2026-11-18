# Coexistence Dashboard v1.0.0.6 — isolated SPFx build
This branch is deliberately separate from main and the installed SharePoint app. It does not deploy automatically.
The source includes the exact pinned dashboard HTML from commit ddc3a2a2361f8001d643b47262e3f4435a38f3c0 with Generate File, plus an SPFx 1.21.1 source project.
Run the GitHub Actions workflow "Build Coexistence SPFx v1.0.0.6" or run `cd spfx && npm install && npm run build`.
It generates dashboard JavaScript as compiled modules, removing blocked inline scripts and srcdoc.
The solution, feature and component IDs are the original ones; host declaration remains SharePointWebPart, matching the version IT confirmed could be installed and used as an app page.
Compilation does not guarantee successful SharePoint provisioning or runtime workbook loading. Test against a separate site first.
