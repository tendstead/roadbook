# Phone access, fill interpretation and chart usability

User-requested implementation in the existing feature checkout, 2026-11-08.

## Scope and decisions

- Parameterize Compose bind address with `ROADBOOK_BIND`, default 127.0.0.1.
  Set ignored local .env to 0.0.0.0 and recreate only Roadbook app; leave DB,
  persistent volumes, sibling projects and host firewall unchanged. Rebuild the
  local app after verification so phone testing includes the UI changes.
- Rename visible tank terminology to Filled to full? / Full fill / Partial fill /
  Unknown. Preserve stored full/partial/unknown values. Add an explicit per-import
  `tank_override` (empty, full, partial, unknown). Empty respects mapped source;
  a selected override applies to all rows, including mapped values. Preserve source
  cells and override provenance. Never infer full status just because unmapped.
  Include override in backend validation/fingerprint and local preview signature.
  Keep per-row reviewed edits and incomplete interval safeguards.
- Retain custom SVG charts. Add five value-labelled grid lines from zero through
  max in quarters, currency-aware fuel labels and unit-aware distance labels.
  Render custom hover/focus/tap tooltips; Escape/outside interaction dismisses.
  Retain an accessible table without a visible View values disclosure. Do not
  change calculation/annual-display rules or interpolate missing year data.
- Localize all UI changes in English/German and verify mobile layout.

## Implementation and verification

1. Failing Go/TS tests for explicit override, default unknown, source preservation,
   invalid override and local/server parity; implement field and controls.
2. Failing browser tests for batch full-fill import, per-row correction, chart
   quarter grid, hover/focus/tap tooltips and no visible disclosure. Implement SVG
   interactions and clear wording; preserve history/export semantics.
3. Verify Compose binding without disclosing secrets; enable local network access.
   Run formatting/lint/types, units, real service and mobile/desktop browser checks,
   production build and audits through make check/app-check. Fresh review before
   finishing; signed commits/push remain authorized by this implementation thread.
4. Rebuild/recreate only local Roadbook app. Verify readiness and host LAN URL;
   report phone URL and limits. No registry release or sibling-service changes.

## Added steering and review

- User additionally requested a sun/moon light/dark switch. Use the shared theme
  tokens and a browser-local remembered preference, initially the device setting.
- Independent review: reproduced and fixed 100-column CSV provenance overflow
  (bounded metadata capacity, source width still 100) and overlapping two-month
  labels at 320px (endpoint labels now against plot boundaries).
- Visual QA: focus highlighting belongs on the visible mark, not its larger
  transparent touch target, so a selected short bar never appears full-height.

## Verification

`make check` and clean-install `make app-check` passed. The final chart geometry
and focus styling were then covered by a fresh complete `make check` run:
21 frontend unit tests, Go race/domain/service tests, 34 desktop/mobile browser
scenarios, production build, backup/restore and workflow lint. Four low frontend
audit findings remain; the high-severity gate passes. Review findings were fixed
with maximum-width import and 320px two-month label regressions. Synthetic chart
screenshots were inspected on desktop and mobile.

The user explicitly authorized the local Roadbook runtime update for phone tests.
No sibling service, database data, host firewall or registry release is changed.
