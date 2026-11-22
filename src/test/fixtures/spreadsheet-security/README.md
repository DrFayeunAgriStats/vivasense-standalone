# Spreadsheet parser regression fixtures (issue #49)

Synthetic data only. Used by `src/lib/__tests__/spreadsheetParserSecurity.test.ts` to pin the parse results of the four
read sites (header:1/defval:"" and object rows/defval:"") so that a SheetJS upgrade can be checked for read parity.

* `mixed.xlsx` - written independently with openpyxl 3.1.2 (padded header, Unicode header, empty column, numbers stored
  as text with leading zeros, dates and a date-time, a second sheet).
* `mixed.csv`, `mixed_bom.csv` - the same table as CSV, without and with a UTF-8 BOM.
* `mixed.xls` - legacy BIFF8 written by SheetJS 0.18.5 from mixed.xlsx (no independent .xls writer was available).
* `golden_0.18.5.json` - parse results produced by the currently shipped xlsx@0.18.5, before any upgrade.
