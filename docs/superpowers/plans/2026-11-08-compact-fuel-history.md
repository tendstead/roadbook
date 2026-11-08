# Compact fuel history

User request: fuel history currently fits only about three entries on a large
screen. Tighten the existing list while retaining clear values and actions.

- Scope compact styling to persisted fuel history; expense and import examples
  keep their existing presentation.
- Put date/station/amount into a short heading, measurements directly beneath,
  and edit/delete actions alongside those lines on desktop. Combine payer/source
  metadata into one wrapping footer. Remove empty attachment whitespace.
- Keep notes and incomplete-data warnings readable, source expansion and receipt
  access available, and mobile controls at least 44px high. No data changes.
- Verify density with 12 synthetic fuel entries, source expansion/editing and
  mobile overflow checks; run full application checks and inspect screenshots.
- Rebuild only the local Roadbook app for the already-authorized phone testing;
  preserve DB/volumes and sibling projects. Signed commit/push follows existing
  delivery authorization after verification.

Verification: old synthetic rows measured about 320px; compact rows pass the
under-145px desktop limit with at least four fully visible at 1440×1080, retaining
notes/source metadata. Mobile controls, source expansion, editing and expanded
delete confirmation pass without page overflow. `make check` passed with 21
frontend unit tests and 36 desktop/mobile browser scenarios, real Go/service,
build/audit/recovery/workflow checks. Independent review found no actionable
issues. Desktop screenshot inspected; local rebuild and signed delivery follow.
