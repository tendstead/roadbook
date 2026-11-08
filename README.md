# Roadbook

A Tendstead car ownership log: fuel, repairs, maintenance, and a graphical view
of running costs and consumption. **Roadbook is the agreed working name.**

Roadbook tracks vehicle history, fuel, upkeep and ownership costs. It follows
[the agreed design](docs/design.md). The original [idea](idea.md) is historical
context.

Planning in progress: [v1.0 product decisions](docs/product-plan.md) and the
separate [v1.1 vision-bill connection](docs/vision-bill-v1.1-plan.md).

## License

Roadbook's original code and documentation are source-available under the
[Elastic License 2.0](LICENSE) (`Elastic-2.0`). Self-hosting, internal use, and
modification are permitted subject to its terms; offering substantial Roadbook
functionality as a hosted or managed service requires separate permission.
This is not an OSI-approved open-source license. Third-party material retains
its own terms; see [source provenance](docs/references.md).

## Technical direction

Follow shopping-list: Go API, PostgreSQL with explicit SQL migrations, and a
Svelte 5 / SvelteKit static TypeScript frontend using the published `@tendstead/ui`
package. Embed the built SPA in one Go executable; ship one application image
plus an independently managed PostgreSQL database. Use containerized tooling.
Select and lock compatible dependency versions when implementing; the sibling
repositories are examples, not a promise that their current pins remain suitable.

Roadbook owns its data, database credentials, and deployment. Vision-bill is
optional. A disabled or unavailable integration must not prevent startup, manual
entry, editing, or statistics. Do not share its database or session cookies.

## Repository outline

```text
cmd/server/static/          Go entry point and embedded frontend output
internal/domain/            vehicle, fuel, cost rules and calculations
internal/store/migrations/  PostgreSQL persistence and versioned SQL migrations
internal/httpapi/           HTTP handlers and request validation
internal/integrations/      optional adapters, initially vision-bill
web/src/routes/             SvelteKit routes
web/src/lib/                components, API client, formatting and charts
web/static/                application icons and other static assets
web/tests/                 browser scenarios
scripts/                   release tooling
.github/workflows/          bootstrap CI
.github/ISSUE_TEMPLATE/     bug and feature forms
docs/                      architecture, development and deployment notes
```

The app includes passwordless profiles, per-vehicle sharing, manual fuel and
expense records, recurring charges, persistent original images and thumbnails,
reviewed CSV imports, JSON export, monthly spending and annual-distance charts.
Unknown fuel data is highlighted and excluded from unreliable consumption ratios.
English and German are available under Settings → Language, with a per-browser
preference. Dates and amounts follow the selected language; CSV formats remain
explicit. See [language support](docs/i18n.md).
Vision-bill integration is planned separately for v1.1.

## Run and verify

Install Docker Compose and Make, run `make deps`, copy `.env.example` to `.env`,
set a random database password, then run `make up`. Open `http://127.0.0.1:8082`.
For an existing dedicated database use `docker compose -f compose.external.yaml`.

`make check` verifies formatting, lint/types, Go vet, dependency
audits, unit tests, isolated PostgreSQL tests, mobile/desktop browser flows,
the production build, backup/restore and workflow syntax. `make app-check` first
installs locked dependencies, then runs the same suite. `make hooks` installs
pre-commit hooks (requires pre-commit locally). Publishing is manual only;
publishing never deploys.

Profiles are not authentication: keep Roadbook on a trusted network/VPN or behind
an authenticated reverse proxy. Images accept JPEG, PNG and WebP (20 MiB each);
HEIC/PDF conversion and offline write queues are not included. Currency is one of
EUR/USD/GBP/CHF/CAD/AUD per installation and locks after entries or schedules exist.

[API](docs/api.md) · [Backup and restore](docs/recovery.md)

[Development and Git flow](docs/development.md) ·
[Release and deployment](docs/deployment.md) ·
[Source references](docs/references.md)
