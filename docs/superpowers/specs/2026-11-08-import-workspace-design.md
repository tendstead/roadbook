# Guided CSV import workspace

Status: implemented and verified 2026-11-08 in the current checkout.

## Intent and scope

Make the one-time migration of existing vehicle history easy to discover and
understand. Keep file inspection and the immediate mapping examples entirely in
the browser. Retain the existing server-reviewed, atomic, duplicate-safe import.
Do not modify vision-bill or add authentication/LLM networking in this slice.

## Approaches

1. Enhance the current mapping selects and retain the review table. Smallest
   change, but gives little sense of the resulting history entries.
2. Add a mapping workspace and extract shared entry presentation from History.
   Recommended: makes the result recognizable while preserving the existing
   review/commit path and useful keyboard/mobile controls.
3. Reuse History itself for draft previews. Rejected: it couples unsaved examples
   to persisted entry editing, deletion, attachments, and application filtering.

## Proposed behavior

- A compact banner above page content links to `/settings#import` while the
  current profile's available history has no fuel or expense records. Adding a
  vehicle alone does not dismiss it. After a successful first record/import and
  state reload it disappears; deleting every record makes it eligible again.
  Suppress the banner in the import workspace itself. No local dismissal flag.
- Settings keeps the importer, with a stable `import` anchor. Before a vehicle
  exists, explain the prerequisite and link to vehicle setup.
- Accept file drop and normal file selection. Read via the browser File API;
  no upload or preview API call occurs while selecting or mapping. Preserve the
  current 1.5 MB, 100-column, 10,000-data-row limits. Quoted CSV cells and embedded
  newlines must remain supported. Do not persist source content in browser storage.
- Display numbered source-column chips with headers and up to two sample cells.
  Choose a source column, then choose a target field, or drag its chip onto that
  field. Every assignment also has a normal select and clear control; dragging
  cannot be the only input method. Unmapped columns remain preserved source data.
- Group target fields by requirement: required for saving (date; expense amount,
  plus schedule frequency), useful for statistics (fuel volume, distance/odometer,
  amount and tank status), and optional descriptive fields. Vehicle and payer
  come from the existing explicit application context. Do not call missing
  measurements invalid if the data model legitimately permits unknown values.
- Explicit controls select delimiter, decimal separator, date format, source
  distance/fuel units, table type, and inclusive start/end rows. Currency remains
  the installation currency; no implicit currency conversion. Add day-first and
  month-first slash dates and year-first dot dates without guessing ambiguous dates.
- Beneath the field targets, show at most two live example entries from the
  selected range using the shared history entry presentation. Update immediately
  on mapping/format changes. Mark these as unsaved examples; show missing and
  invalid fields explicitly. Do exact integer decimal conversion, never floating
  point monetary arithmetic. Preserve unknown tank status and incomplete data.
- The explicit Review import action sends the source and mapping to the existing
  server preview endpoint. Retain selected-row corrections, source issues,
  duplicate acknowledgement, schedule support, pagination, and atomic commit.
  Invalidate server review whenever its source/mapping/interpretation changes so
  stale reviewed rows cannot be committed under a new-looking configuration.
- Extract entry presentation only; never fetch receipt images for sample drafts.
  Keep full history actions and attachments in History. Localize new copy in
  English/German and preserve mobile layout without page-wide horizontal overflow.

## Deferred

Optional local AI can eventually populate the same mapping object. This slice
does not add model credentials, a proxy endpoint, or promises of vision-bill API
support. Median outlier review is a distinct calculation-policy change and is
not implemented implicitly by this UI rework. Unknown tank status is not forced
to full for arbitrary imports.

## Verification

Use synthetic CSV only. Test local parsing/preview exact values and date errors;
file selection/drop; click, keyboard and drag mapping; range and source-unit
changes; no network source transmission before review; stale-review invalidation;
initial banner lifecycle; mobile/desktop layout; and retained duplicate-safe
commit, schedule and German-language flows. Run `make check` and `make app-check`
as required, reporting actual results and any environmental blockers.

## Workspace

Existing staged English/German work is present on `feat/roadbook-v1` and must be
preserved. The user requested implementation here and now, followed by commit and
push. Preserve the language snapshot in its own prerequisite commit at delivery;
do not move, reset or stash it as incidental setup. Implement inline in this checkout.
