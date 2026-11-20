# v1.0.0.12 — restore workbook package compatibility without changing model
The user-uploaded SharePoint workbook differs from the pinned v3 reference at the OOXML container metadata level: 5,884,347 vs 5,876,298 bytes. A core fingerprint over all 21 worksheet XML files, workbook.xml, sharedStrings.xml and styles.xml is identical (c4ca81bbb5ace2a89a5621f31322b603ad54f52678b75b633132da6db8558eec).

The app now normalises workbook relationship order and removes Office-generated custom XML and trash package members in memory before calling the EXACT unchanged GitHub calculation scripts. This does not edit source worksheet cells, employment rules, agency cost formulas, periods or source files. Original Excel on SharePoint remains unchanged.

Explicit post-load validation requires 10 branch controls, populated People and Jobs, and a CT weekly chart. On a failure, the dashboard is hidden rather than presenting false financial cost/exposure. Check and browser-test the compiled SPFx .sppkg, both with reference workbook and Office-style repackaging fixtures.

This is a new candidate, not a claim of live tenant parity. It does not touch main or deploy to SharePoint.
