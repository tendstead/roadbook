# Compact import mapping workspace

Approved direction in conversation: header-only source chips; selected-column
examples in one shared strip; compact destination rows; collapsed optional fields
and collapsible format settings. User explicitly approved a small hint explaining
that clicking a chip reveals example values. Implement here in the existing branch.

- Keep every source column available, including unnamed ones. Chip labels use
  column number/header only; click/Enter/Space selects, dragging still maps.
- Show up to two raw examples for the selected column from the chosen row range.
  Keep long source strings bounded visually without changing source data.
- Destination rows show the field once, an accessible column selector, and a
  labelled clear control. Keep required/statistical groups visible and optional
  details collapsed initially. Preserve touch targets, drag and keyboard mapping.
- Collapse format controls initially behind a summary of type, delimiter, dates,
  decimals and units. Full-fill assumption remains visible. Expand controls to
  change interpretation; disclosure state alone must not invalidate review.
- Preserve exact local previews, transaction/duplicate behavior, unknown handling,
  per-row corrections, source data, and frontend-only preparation. No new packages.
- Test source-chip selection/examples, optional/format disclosures, drag/click/
  keyboard paths, dimensions, no early import requests and stale-review guards on
  mobile/desktop. Update existing language/import flows to open disclosures.
  Run full checks, inspect screenshots, review and rebuild only local Roadbook.
  Signed commit/push follows the ongoing delivery authorization.

Verification: targeted 14 desktop/mobile import and German-language scenarios
passed. Fresh complete `make check` passed with 23 frontend unit tests and 36
browser scenarios, Go/service/build/audit/recovery/workflow checks. Independent
review found no actionable findings. Screenshot review also exposed the old
numeric/string mismatch in the unmapped select option; a failing browser test
reproduced it, and numeric `-1` now displays the explicit Not mapped choice.
Desktop/mobile screenshots were inspected. No source data or API contract changes.
