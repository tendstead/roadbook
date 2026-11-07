# Roadbook v1.0 — product planning record

Updated 2026-11-07. This records the planning conversation, not a finished or
approved implementation specification. Confirmed choices are separated from
proposals and open questions. Read with `idea.md` and contributor guidance.

## Purpose and delivery

Replace a personal car-cost Sheet with convenient fuel/expense entry, reliable
history, and useful graphical summaries. Support other self-hosters rather than
hard-coding one person's vehicle, distance-entry routine, or units.

Finish the product design before implementation. Delivery then proceeds as a
minimal working baseline on main, followed by a feature branch and PR for the
Roadbook functionality. All commits must be signed. Public repository requested:
`tendstead/roadbook`. No publication or implementation is claimed by this document.

## Confirmed product decisions

### Profiles and vehicles

- Start with passwordless profiles. Authentication remains a separate future
  decision; vision-bill must not become Roadbook's login dependency.
- Vehicles may be assigned to one profile or shared with selected profiles.
  Support multiple vehicles, including cars and motorbikes.
- Hide the profile switcher, sharing controls, and payer selector when there is
  only one profile. Assign expenses to that profile automatically.
- Record one payer per expense when profiles are used. No split payments,
  balances, or settling-up functionality initially.
- Passwordless profile selection is organization, not authenticated privacy.

### Overview and costs

- Show monthly fuel spending, consumption in L/100 km, and fuel cost in EUR/km
  by default for this user's setup. Other users need explicit unit settings.
- Show total recorded expenses: purchase, fuel, repairs/upkeep, insurance, tax,
  leasing, and other vehicle expenses.
- Show average monthly upkeep cost over ownership. Include workshop bills,
  repairs, servicing, tyres, inspections, parts, and similar work. Exclude fuel,
  insurance, tax, and acquisition; keep leasing separate from upkeep.
- Bills and receipts are optional. Manual expense entry is fully usable.
- Support one-time and monthly, quarterly, or annual recurring expenses.
  Recurrences count automatically when due, without payment confirmation.
  Support an optional end date, including fixed-term leasing.
- Add a km/year number useful for insurance and a multi-year line graph with a
  separate colour for each vehicle.
- Adapt the annual-distance display to available history: less than one year,
  show total recorded km; from one through two years, show previous-calendar-year
  km and current-calendar-year km; after more than two years, show a line graph
  with one point per calendar year, including the current year, per vehicle.
- Mark the current year as in progress with a visible label and explanatory
  tooltip/help text: its total changes as more distance is recorded. Do not
  extrapolate a full-year total or proportionally estimate distance across years.

### Fuel and distance

- Support both total odometer readings and explicit distance driven since the
  preceding fuel stop. Users may supply both; do not require trip-counter resets.
- Provide an application-wide km/miles setting. Changing display units must
  convert existing measurements rather than reinterpret their numeric values.
- Explicit distance takes precedence over an odometer-derived difference. Retain
  odometer readings independently, and highlight disagreements. Preserve decimal
  distances, including 0.1 km precision, without rounding them to whole kilometres.
- Attribute interval distance to the closing entry's date, including across New
  Year; do not estimate a proportional share in another calendar year.
- Odometer differences can supply distance when successive usable readings exist.
  Custom distance supports resets between fills and other corrected intervals.
- The historical export does not establish that every fill was full or every
  distance was complete. Preserve uncertainty rather than assuming completeness.
- Record full, partial, or unknown tank status. Incomplete records must remain
  saveable without inventing consumption values. Highlight gaps, show the data
  as recorded, and exclude unreliable intervals from consumption calculations.
- Default consumption display is L/100 km, as subsequently chosen in discussion;
  the distance-entry choice does not change that display unit.

### Attachments and mobile data

- Attach dashboard photos and optional receipts/bills to relevant entries.
  Dashboard photo reading is manual initially; no dashboard OCR in v1.0.
- Keep original uploaded files. Generate reduced previews once and persist them;
  do not resize on every request. Use browser caching as well.
- Lists load thumbnails lazily on all viewport sizes. Loading a list must never
  fetch originals automatically, including when thumbnails are unavailable.
- Fetch larger images only on explicit viewing/download. Retaining originals
  means original upload bandwidth is still required.
- In v1.0 Roadbook owns all attachments and must back up files with its database.
  Dashboard photos always remain in Roadbook, including after future integration.

### CSV import

- Include configurable CSV imports in v1.0. Imports are normally a one-time
  migration, not live Sheet synchronization.
- Support fuel, upkeep, and annual/recurring-cost data. The user describes three
  source tables; the supplied fuel CSV contains fuel rows and summary figures,
  not itemized repair and annual-cost tables. Separate exports may be needed.
- Provide reviewable column mapping and interpretation. Import configuration is
  independent of startup and normal manual application use.
- Preview and review before saving. Validate values deterministically, surface
  ambiguous/missing fields, and prevent accidental repeat imports.
- Preserve otherwise unmapped source information or require an explicit ignore
  decision. Never invent missing amounts, volumes, dates, or distances.
- Keep real exports out of Git, Docker context, tests, and committed examples.
  This document intentionally contains no private source rows.

## Proposed application and technical structure

These are proposals pending design review, not implemented contracts.

- Navigation: Overview, Fuel, Costs & upkeep, and Vehicle/settings. Put imports,
  profile management and units under settings.
- Keep a vehicle selector when the active profile has multiple vehicles,
  independently of whether the profile switcher is visible.
- Go API and domain rules, PostgreSQL with explicit SQL migrations, Svelte 5 /
  TypeScript static frontend using published `@tendstead/ui`. Embed the frontend
  in the Go executable; use one app image plus an independent PostgreSQL database.
- Follow shopping-list's directory layout and containerized Make commands.
  Keep domain calculations separate from HTTP, persistence, and integrations.
- Store attachment metadata in PostgreSQL and originals/previews in a persistent
  Roadbook file volume. Never depend on another service's filesystem.
- Prefer a trusted LAN/VPN or authenticated reverse proxy for passwordless mode,
  with loopback binding by default. Decide browser write protection explicitly.
- Use exact monetary arithmetic and explicit distance/volume units. No binary
  floating-point arithmetic for monetary values.
- Sum full-to-full fuel intervals, excluding the opening fill's litres and
  including partial fills through the closing full fill. Aggregate by total
  matched litres / total matched distance, never average interval ratios equally.
- Use unique recurrence occurrences and catch up due costs after restarts.
  Changes to future schedules should not silently rewrite historical expenses.
- Annual distance should count each distance once and identify incomplete
  coverage. Do not annualize or proportionally split intervals across years.
  Attribute intervals to the closing entry's calendar year as agreed above.

## Repository foundation and verification

- Extend AGENTS.md and development, deployment, API, backup, and contribution
  guidance as the design becomes concrete. Add security reporting guidance and
  documented configuration without exposing secrets.
- Shopping-list and vision-bill currently have no local PR/issue templates.
  UI has templates; adapt their validation and AI-assistance fields into
  Roadbook's existing basic templates.
- Match shopping-list's local pre-commit formatting, lint/type, and vet checks;
  install hooks for this checkout and document installation for contributors.
- Use the existing Alexander Heinecke signing identity from sibling repositories;
  verify signatures before pushing. Never fall back to unsigned commits.
- The configured sibling SSH alias is `github-alex-heine`; the user requested
  `git-alex-heine`, which does not currently resolve to GitHub in SSH configuration.
  Resolve the alias explicitly before configuring/pushing the remote.
- Unit tests: fuel intervals, missing data, custom/odometer distance, exact money,
  recurrence, import validation, and frontend behavior.
- Service tests: isolated PostgreSQL migrations, persistence, API validation,
  duplicate prevention, recurrence catch-up, attachments, and restore behavior.
- E2E tests: mobile/desktop entry and history, conditional profile controls,
  vehicle sharing, import review, dashboards, and attachment viewing. Verify that
  a 20-entry list requests no original images.
- Replace the intentionally failing app-check with real application verification.
  Bootstrap release-script checks alone never establish application readiness.
- Keep tests in disposable Roadbook stacks; never touch sibling app data/volumes.
  Use manual GHCR releases after full checks. Publishing is separate from deploy.

## License — Elastic License 2.0 selected

The user selected Elastic License 2.0 (`Elastic-2.0`) on 2026-11-07 after discussing
the risk of competing hosted services, including free services. Use the unmodified
root `LICENSE` for Roadbook-original material. It permits self-hosting, internal
use, modification, and redistribution subject to its terms, and restricts offering
substantial functionality as a hosted or managed service without separate
permission. It is not a blanket prohibition on commercial resale. Describe
Roadbook as source-available, not OSI open source.

The user retains the intention to offer add-ons and managed hosting. Resolve
contribution rights and provenance of inherited release tooling before public
publication; do not assume sibling code can be relicensed. No license was found
in shopping-list's inspected local checkout or remote default-branch root.
No changes to sibling repositories are authorized here. This choice does not
relicense vision-bill or any other existing project.

## Decisions still needed before an implementation specification

- Validation details for missing/reset/corrected odometers and missed fills;
  explicit-distance precedence and highlighting incomplete records are agreed.
- Fuel EUR/km numerator and matching distance coverage, monthly boundaries, and
  handling of money paid by someone else. Avoid dividing arbitrary period costs
  by unrelated measured distance.
- Annual-distance metric: confirm the history-duration anchor and explain
  incomplete history; intervals use the closing entry's calendar year.
  Display thresholds and the in-progress current-year indicator are agreed above.
- Ownership start/end, acquisition and disposal details, upkeep-average month
  denominator, expense categories, refunds, currencies, gallons/miles, and locale.
- Recurrence anchor/day-of-month behavior, effective edits, exceptions,
  and historical insurance/tax import without double counting.
- Profile/vehicle ownership and deletion rules, sharing permissions, and access
  controls appropriate to a passwordless deployment.
- Import review and preservation format, configuration and limits;
  attachment types/limits/deletion; exact preview sizes and image serving policy.
- Confirm navigation and entry workflows; export and backup/restore experience;
  offline-entry scope; chart library selection after agreeing views.

The separate [v1.1 integration plan](vision-bill-v1.1-plan.md) records future
receipt-service work. It is not a prerequisite for v1.0.
