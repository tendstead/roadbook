# Roadbook v1.0 implementation specification

This consolidates the agreed product direction. Implementation is authorized by
the user's request to start. Defaults below are engineering decisions, recorded
explicitly rather than presented as additional user requirements.

## Architecture and approaches

Use the agreed standalone Go + PostgreSQL + Svelte 5/TypeScript application with
published `@tendstead/ui`. Serve an embedded static SPA and JSON API from one Go
binary. Separate domain rules, storage, and HTTP. Containerize tools and runtime.
An external shared PostgreSQL server is supported using a dedicated Roadbook
database and role. No direct sibling-service SQL or source dependencies.

The alternatives discussed were live receipt references, synchronized receipts,
and independent vehicle records with referenced receipt images. The user chose
independent vehicle records; v1.0 owns attachments locally and v1.1 may transfer
receipt ownership to vision-bill. No v1.1 API adapter is implemented now.

## Data and API

UUID identifiers. SQL migrations track applied versions. Settings store one
global distance unit (`km`/`mi`), fuel unit (`L`/`US gal`/`Imp gal`), currency
(one ISO currency per installation, initially EUR), and calendar timezone
(default Europe/Berlin). Reject currency changes once financial records exist.
Store money as signed integer minor units and expose integer minor units in JSON;
fuel volumes and distances use scaled integers: millilitres and metres. Preserve
entered decimals through exact unit conversion, rounding only to stored precision.

- Profile: id, name. Create a default profile on setup; no passwords.
- Vehicle: id, name, kind (car/motorbike/other), fuel type, ownership dates,
  optional initial odometer, owner profile and member profiles. Ownership start
  and purchase price are optional. Represent purchase as an ordinary acquisition
  expense, never both a vehicle total and an expense. Ownership end archives it.
- Fuel entry: vehicle, payer, local calendar date, stable creation order,
  nullable odometer, custom distance, volume and amount, full/partial/unknown,
  station, fuel type, notes, explicit missing-record/reset flag, extra import data.
- Expense: vehicle, payer, date, amount, category, description, optional odometer,
  notes and extra import data. Upkeep categories: repair/service/tyres/inspection/
  parts. Other categories: purchase/insurance/tax/lease/parking/toll/other.
  Refunds use negative expense amounts and reduce the matching category's total.
- Recurrence: expense template, first due date, monthly/quarterly/annual, optional
  inclusive last due date. Unique (schedule, due date) materialized expenses.
  Generate due occurrences at startup and before reads; DB transaction and unique
  keys make concurrent requests safe. Anchor to original day, clamp short months.
  Editing a schedule affects unmaterialized future dates only. Disable to stop it.
  Materialize already-due charges before edits. The first due date and frequency
  are immutable after creation; end the old schedule and create a replacement to
  change them. Amount/category edits apply after today, never to past charges.
- Attachment: vehicle/entry, purpose dashboard/receipt/bill, generated storage id,
  original filename, detected media type, bytes, content hash, thumbnail path.
  Originals and persistent previews live in an app-owned data volume.

JSON endpoints under `/api`: settings; profiles; vehicles and membership; fuel;
expenses; recurrences; dashboard (profile and vehicle filters); attachments;
import preview/commit; export. CRUD uses explicit validation and consistent JSON
errors. Queries check vehicle membership for the selected profile, but passwordless
profile selection is explicitly not a security boundary. Sharing management is
available to owners; deleting a referenced profile is rejected. Entry deletion
requires confirmation in UI. Vehicle deletion is rejected while records exist;
archive instead. No generated client or runtime dependency on another service.

All modifying browser requests require same-origin verification and a custom
request header; JSON requires application/json. Reject oversized bodies. Default
deployment binds loopback and has no public accounts. Health liveness is separate
from DB readiness. Graceful shutdown closes HTTP and database connections.

## Calculation contract

Sort fuel by date then stable creation order. Custom distance overrides odometer
difference; retain both and flag disagreement beyond 100 metres. Without custom
distance, derive only from the immediately preceding entry's valid odometer (or
an initial reading for the first entry). A negative difference is a gap, never
an absolute distance. A reset/missing-record flag breaks consumption continuity.

Annual/monthly distance sums each usable interval once on its closing date.
Never distribute across dates or extrapolate. Unknown distance is a visible gap.
Full-to-full consumption excludes opening volume, accumulates subsequent partial
fills and closing fill, and requires positive complete distance and known volume.
Unknown fullness, missing volume/distance or a reset breaks the interval; the
next full entry establishes a fresh baseline. Aggregate matched volume/distance.
Fuel cost/distance uses paid amounts from those same complete intervals excluding
the opening fill's cost. An interval with missing cost is omitted from both the
cost numerator and its matching distance denominator; report complete-subset
coverage and gaps. If no complete priced intervals exist the ratio is unavailable.
Period consumption assigns complete intervals to their closing date; label this.
Fuel spending is paid-date cash spending and includes incomplete fuel records.
Do not conflate these two period definitions. Statistics use exact rational
arithmetic before presentation; unavailable metrics are null with gap reasons.

Total expenses = fuel paid + all expense categories, including due recurrence
occurrences, with acquisition counted once. Upkeep/month = net upkeep expenses /
elapsed ownership months (elapsed days / 30.436875), until ownership end or today;
missing/zero ownership duration returns unavailable, never guessed duration.
Show source totals and date range beside the average. Charts expose tabular data.
Annual display uses earliest recorded distance date: <1 calendar anniversary total,
1–2 inclusive previous/current calendar years, >2 yearly line points per vehicle.
Mark current year in progress. Gaps remain visible in graphs, not fabricated zeroes.

## UX, import, and attachments

Mobile-first purple shell, outline icons, neutral surfaces. Four destinations:
Overview, Fuel, Costs & upkeep, Settings. Quick Add fuel is prominent. Choose
vehicle if more than one is available. Hide profile/sharing/payer controls when
only one profile exists. Settings supports first vehicle, profiles, membership,
units, schedules, CSV import/export and backup guidance. No offline write queue.
Never imply an unsaved form is stored; retain form values on recoverable errors.
English/German interface language is detected from the browser on first use and
can be overridden per browser in Settings. Localize presentation and known feedback,
keeping stored values, units and CSV interpretation independent; see [i18n](i18n.md).

Overview: monthly fuel spending bars, consumption/fuel-cost cards, total-expense
card, upkeep/month, yearly distance display, recent entries and gap explanations.
History supports edit/delete, vehicle/date filters and attachment viewing.

CSV import supports delimiters comma/semicolon/tab, localized decimal/date
formats, multiple table ranges per file, fuel/expense/schedule types and mapped
columns. All rows preview as valid/warning/error; block invalid selected rows;
allow deselection. Preserve unmapped cells as extra data unless explicitly ignored.
Summary cells are not silently treated as itemized records. Commit in one DB
transaction with a content+mapping+vehicle fingerprint and per-row keys. Repeat
commit is idempotent; warn about matching existing records. Unspecified API tank
status remains unknown; import assumptions are visible in the fill-type control. Export complete records and metadata with explicit units.

The v1 guided import workspace lives at Settings → Import (`/settings#import`).
An empty-history banner links there until the first fuel or expense record exists.
Read dropped/selected CSV files in the browser, show compact source-header chips
with two raw examples for the selected column, and map through drag, click or
accessible dropdowns. Destination fields use compact rows; optional details and
format settings start collapsed with an interpretation summary. A short hint
explains that selecting a chip reveals example values. Explicit source formats
and units drive two unsaved examples using the shared history-entry presentation.
No source is sent until server review is requested; interpretation/context changes
invalidate review. See [workspace design](superpowers/specs/2026-11-08-import-workspace-design.md).

Attachments accept JPEG/PNG/WebP, validate actual decoding, correct orientation,
retain original bytes, cap each file at 20 MiB and decoded image at 40 megapixels.
Generate a maximum 512px JPEG preview once, persist it and never upscale. A failed
preview shows a placeholder, never an original fallback. Lazy thumbnail loading
on every viewport. ETags and private cache headers support repeat viewing.
Original endpoint is fetched only after explicit open/download. Files use random
ids, no user-controlled paths; reject non-images. Backup/restore includes DB and
files together. Document unsupported phone image formats honestly.

## Delivery, license, and acceptance

First establish a runnable shell, DB readiness/migrations, container tooling and
real unit/service/e2e CI on main using signed commits. Then branch for full v1.0,
review, run all checks and open a feature PR. No automatic merge, release or deploy.
Published dependency versions must be verified and lockfiles committed. Preserve
existing files and private exports. Original material uses Elastic-2.0; provenance
of inherited scripts remains explicit. Do not publish rights-unclear material.

Tests cover exact values and failure behavior: partial/missed fills, weighted
aggregation, custom/odometer precedence, decimal units, date boundaries, refunds,
recurrence month-end/end-date/restart/concurrency, CRUD/membership, import atomicity
and retries, attachment original preservation/caching and no list-original traffic,
mobile/desktop first use and shared-vehicle flows. Isolate test DBs/volumes and
resource limits. Full checks include formatting, lint/types, vet/audits, unit and
service tests, e2e, production build and workflow lint. Real exports are local
acceptance input only, never fixtures or repository configuration.

## Fill interpretation and overview interactions

Visible fuel labels use “Filled to full?” and full/partial fill wording. A CSV
batch override is an explicit user assertion, not an inference from a missing
column. It updates local and server previews, retains source cells/provenance and
allows per-row corrections. A newly selected file resets the batch assertion.

Custom SVG overview charts show five value-labelled grid levels from zero to the
maximum, responsive non-overlapping period labels, and hover/focus/tap tooltips.
Exact values remain in a screen-reader-accessible table without a visible
“View values” disclosure. The header sun/moon control stores light/dark preference
per browser, initially following the device, using the published shared theme.

The user-requested CSV import default is “All fills were full,” preselected when
choosing each file. It is shown explicitly in local examples and server review,
with per-row correction and CSV/partial/unknown alternatives retained. This is a
UI default for the reviewed import, not a change to unspecified API values or
existing records. Full-fill is listed first in the import review dropdown.
