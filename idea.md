# Roadbook — base idea and next-session handoff

Historical starting idea. See `docs/design.md` for the implementation direction
agreed in the subsequent planning conversation, including Elastic License 2.0.

Status: initial idea, 2026-11-07. This is a discussion starting point, not an
approved product design or implementation plan.

## What I want

I currently keep a Google Sheet for my car. I enter repairs, costs, fuel stops,
and related information, then calculate figures such as ct/km and consumption.
I want to turn this into an attractive, useful graphical overview that makes the
car's history and running costs easy to understand and keeps entry convenient.

Use the shared Tendstead UI library and a similar structure and technology stack
to shopping-list. Use the same manual GitHub Actions → GHCR image release pattern
as shopping-list and vision-bill. Roadbook must be independently usable and
independently deployable. Vision-bill is being worked on in another session;
do not modify it or assume its API will remain unchanged.

Roadbook is the selected working name; it has not been checked for trademark,
domain, or repository availability. Final branding can wait.

## Confirmed constraints

- A new independent repository beside `shopping-list`, `ui`, and `vision-bill`.
- Go backend, PostgreSQL, Svelte/TypeScript frontend following shopping-list.
- Published `@tendstead/ui` for the shell/theme, not copied UI-library source.
- Fuel, repair and other car costs, with graphical summaries and per-km metrics.
- Optional vision-bill link for uploading/analyzing fuel receipts.
- Manual operation remains fully usable without vision-bill or another Tendstead service.
- Whether application authentication is needed remains an open decision.
- This session creates only the rough repository/workflow foundation. Product
  planning belongs in the next session.

## Proposed starting direction — discuss before implementing

Start with one personal car, but consider whether a vehicle ID now would avoid
pain when replacing the car later. Candidate sections are Overview, Fuel, Costs
& maintenance, and Vehicle/settings. These are proposals, not fixed navigation.

The overview could show spending by period/category, fuel consumption over time,
running cost per kilometre, recent entries, and distance covered. Drill-downs
should show the entries and distance behind each figure. Empty or insufficient
data should explain why a metric is unavailable.

Use a minimal mobile-first interface, shared purple theme, neutral surfaces and
simple outline icons. Entry at a fuel station should be quick. Desktop should
make history and trends easy to inspect. Do not select a chart library or design
screens until the intended views are discussed.

## Data and calculations to work through

Bring a description or sanitized export of the current Sheet into the next
session if convenient; no Google account access or live connection is configured.
Understand its columns and formulas before replacing them.

Candidate data, to refine:

- Vehicle: name, fuel type, currency, ownership dates, initial odometer.
- Fuel stop: date, odometer, litres, total paid, full/partial tank, station,
  notes, optional receipt reference. Unit price can be derived when valid.
- Cost entry: date, category, amount, odometer when known, description and
  optional receipt; repairs, servicing, tyres, tax and insurance are candidates.
- Distance/baseline records if odometer tracking beyond fuel stops is needed.

Calculation examples, **not yet complete accounting rules**:

- L/100 km = litres consumed / distance in km × 100. L/km is the same ratio
  without × 100; clarify which display I want. Do not silently change my units.
- ct/km = included cost in euros × 100 / matching distance in km.
- A full-to-full fuel interval sums fuel added after the opening full fill
  through the closing full fill, including intervening partial fills; the opening
  fill's litres are excluded. This needs complete records and positive distance.
- Aggregate consumption by total litres / total matched distance, not by taking
  an unweighted average of individual fuel-stop figures.
- Clearly distinguish fuel-only ct/km from all selected ownership costs.
- Store money exactly (minor units or fixed decimals); avoid binary floats for
  financial values. Use explicit units and sufficient precision for fuel volume.
- Define zero distance, missing odometers, corrections, out-of-order entries,
  missed fills, refunds and expenses outside recorded distance coverage.
- Decide period boundaries: a fuel interval can cross a month boundary, and
  insurance can cover a year. Do not assume date-filtered costs and measured
  distance automatically represent comparable periods.
- Purchase price, depreciation, sale value, parking, tolls, fines and charging
  may or may not belong. Ask rather than building them all.

## Optional vision-bill integration

Two independent capabilities, with a staged recommendation:

1. **Link first:** a configured service link opens vision-bill for upload/review.
   It uses vision-bill's own login. A link alone does not import data into Roadbook.
   Manual Roadbook entry remains available.
2. **Optional adapter later:** explicitly connect to a supported API or import
   format, select/upload a receipt, receive its analysis, and map fuel fields into
   a Roadbook draft for review. Confirm litres, total, date and odometer before
   saving. A receipt usually cannot supply the odometer or full-tank flag reliably.

Do not promise a working upload deep link, fuel-specific schema, SSO or service
credential flow before inspecting the then-current vision-bill implementation.
No modifications there are part of this repository setup. Agree any future API
change in its own session. No shared database, filesystem, runtime dependency,
source-code dependency or copied auth implementation.

Persist the reviewed fuel/cost entry in Roadbook so it survives vision-bill being
unavailable or removed. A source receipt ID/URL is optional metadata. Define
import deduplication, timeouts, deletion behavior, credential storage and which
service owns any original image before implementing the adapter. Do not send
private receipt data to external analysis services by default.

## Authentication — choose after access needs are clear

Recommended starting point **if this remains a single-user private service**:
no built-in accounts, reachable through a trusted LAN/VPN or authenticated reverse
proxy, with loopback publication by default. Financial/car history is personal;
network access must be an explicit deployment choice. App-shell account controls
are presentation only, not an authentication system.

If it needs public Internet access or separate users and data ownership, decide
on app-owned auth or an independent identity provider/proxy before exposure.
Vision-bill's current login is not assumed to be a reusable identity service.
It must not become a mandatory login dependency. API access controls and browser
write protection still need planning even if there is no login screen.

## Scope suggestions

Likely first useful milestone: manual fuel and cost entry, reliable history,
reviewed calculation rules, a useful overview, export/backup, and optional
vision-bill navigation. Decide whether Sheet CSV import is essential to that
milestone; historical data is likely important for meaningful charts.

Defer live Google Sheets synchronization, automatic OCR imports, service booking,
OBD/telematics, multi-user roles, EV charging and maintenance reminders unless I
say they matter. These are open scope choices, not rejected features.

## Questions for the next session

Start with how I use the Sheet and what I want to learn when I open the app.
Then work through:

1. What columns/formulas/history exist, and what should be imported?
2. One car now, multiple cars, or a history of replaced cars?
3. Which costs count toward which ct/km figure, over what distance and period?
4. Which consumption units, currencies and language/date formats do I want?
5. How do I record partial fills, missed fills and odometer corrections today?
6. What is the smallest useful dashboard and the preferred fuel-entry flow?
7. Private network only, or remote/public use; anyone besides me?
8. Is a vision-bill link enough initially, or is receipt-to-draft import essential?
9. Do original receipt images belong here, there, or only as references?
10. Are CSV import/export, maintenance reminders or offline use essential at launch?

## Repository and workflow state

See `README.md`, `docs/development.md`, and `docs/deployment.md`. This is a local
scaffold with bootstrap CI, inherited release tooling/tests and an inactive
release workflow template. No runnable application, release image, remote,
branch protection, push, publication or deployment is created by this setup.
The license is undecided; do not assume sibling application code can be relicensed.

## Paste into a new planning session

> Work in `/mnt/hdd_gaming/dev/tendstead/roadbook`. Read `AGENTS.md`, `idea.md`,
> `README.md` and `docs/` first. Help me refine Roadbook, my independent car fuel,
> maintenance and cost tracker replacing a Google Sheet. Use shopping-list as
> the Go/PostgreSQL/Svelte/TypeScript structure and manual GHCR release reference,
> and the published `@tendstead/ui`. Vision-bill is under active development:
> keep it read-only and optional. Start by understanding my Sheet and desired
> overview; agree calculation rules, auth/access needs, import scope and receipt
> integration before implementing. Treat the proposals in idea.md as open for
> discussion. Produce a concrete design and staged implementation plan.
