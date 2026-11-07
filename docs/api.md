# HTTP API

Roadbook serves JSON under `/api` and its static SPA at `/`. IDs are UUIDs.
Money is integer minor units in the configured currency; distances are integer
metres and volumes integer millilitres. Nullable fuel values remain unknown.
Consumption and ratio results are decimal strings, calculated with exact ratios.
Currently supported currencies use two decimal places: EUR, USD, GBP, CHF, CAD,
and AUD. There is no currency conversion.

All writes require `X-Roadbook-Request: 1`. JSON writes require
`Content-Type: application/json`. Browser writes must be same-origin; Roadbook
does not enable cross-origin credentials. `X-Roadbook-Profile` selects a profile;
image requests use `?profile=<id>` because image elements cannot set headers.
These identify a selected profile, not an authenticated principal. Protect the
installation with a trusted network or authenticating reverse proxy.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Process liveness |
| GET | `/api/ready` | Database readiness, 503 when unavailable |
| GET | `/api/state` | Settings, profiles, assigned vehicles, records, attachments, schedules and per-vehicle statistics; catches up due schedules |
| POST / PUT | `/api/profiles` / `/api/profiles/{id}` | Create or rename a profile |
| POST / PUT | `/api/vehicles` / `/api/vehicles/{id}` | Create or update owned vehicle and sharing; archive with ownership end |
| POST / PUT / DELETE | `/api/entries` / `/api/entries/{id}` | Fuel and expense records; generated charges keep an immutable due date |
| POST / PUT | `/api/schedules` / `/api/schedules/{id}` | One monthly, quarterly or annual expense template; optional inclusive end date |
| PUT | `/api/settings` | Units, timezone and currency; currency locks after records or schedules exist |
| POST | `/api/attachments` | Multipart `entry_id`, `purpose` (dashboard/receipt/bill), `file` |
| GET | `/api/attachments/{id}/thumb` | Persistent JPEG preview, never original fallback |
| GET | `/api/attachments/{id}/original` | Original bytes; `?download=1` requests download |
| DELETE | `/api/attachments/{id}` | Remove attachment metadata and files |
| POST | `/api/import/preview` | Parse configured CSV table and return editable rows, errors, warnings and fingerprint |
| POST | `/api/import/commit` | Transactional selected-row import; repeat source rows are skipped |
| GET | `/api/export` | Versioned JSON export of canonical records, source cells and attachment metadata; excludes image bytes |

Fuel and expense records share an entry interface, with `kind: fuel` or
`kind: expense`. Profile filtering is server-side; owner-only vehicle edits are
checked by the API. The state response is intended for small personal histories,
not an unbounded fleet feed; pagination will be needed before fleet-scale use.

CSV requests specify raw `csv`, delimiter, decimal separator, date format, source
units, table kind, vehicle/payer, inclusive start/end rows and zero-based column
indexes. Row 1 supplies header labels. Amount/volume/distance columns are parsed
into canonical units. Source files are capped at 1.5 MB, 100 columns and 10,000
rows; split larger histories. Original cells are retained with imported records.
Matching-record warnings require explicit review; importing a summary as a real
expense requires a deliberate valid record rather than guessing its date.

`/api/import/commit` accepts `{spec, rows, allow_matches}`. Each selected row keeps
its source row number and reviewed entry; the server restores source cells from
the CSV, validates references and values, and commits atomically. Reusing the
same source/configuration fingerprint and row is idempotent, even if a previous
request's response was lost. Different table mappings have different fingerprints.

Receipt integration endpoints are deliberately absent in v1.0. The separate
v1.1 plan defines the proposed service boundary; it is not a promise that any
vision-bill endpoint already supports that contract.

Deletion queues file cleanup transactionally with metadata removal. Successful
requests attempt cleanup immediately; pending work is retried on state reads, so
a temporary filesystem failure does not permanently orphan deleted images.
Invalid imported numbers require correction or an explicit unknown-value choice.
An invalid recurring end date must be corrected or explicitly accepted as an
indefinite schedule; it is never silently discarded.
