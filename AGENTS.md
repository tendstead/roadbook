# Roadbook contributor guidance

Read `idea.md`, then `docs/design.md` before planning or implementing. The original
idea is historical; the design consolidates the user's implementation direction.

- Match shopping-list's Go/PostgreSQL/Svelte 5/TypeScript structure. Consume the
  published `@tendstead/ui` package and theme. Keep Roadbook independently deployable.
- Keep vision-bill read-only: it is under concurrent development. Do not edit its
  files, branches, containers, database, or shared infrastructure from this task.
- Own Roadbook's database and credentials. Optional vision-bill integration must
  not be required for startup, manual use, or historical data access.
- Establish fuel interval and cost/distance rules before implementing statistics.
  Test actual calculation cases, particularly partial fills and incomplete data.
- Use exact monetary arithmetic. Keep real receipts, Sheet exports, credentials,
  uploads and database backups out of Git, Docker context and test fixtures.
- `make check` and `make app-check` run real application checks. Keep unit,
  isolated service, mobile/desktop e2e, build and audit checks meaningful before
  activating releases. Never describe release-tool tests as application verification.
- Follow `docs/development.md` for Git flow and `docs/deployment.md` for releases.
  Do not publish, deploy or modify another project without authorization.
- Roadbook-original material uses Elastic License 2.0 (`Elastic-2.0`), chosen by
  the user. Describe it as source-available, not OSI open source. Preserve
  third-party notices and provenance; do not assume sibling application code or
  inherited tooling can be relicensed. See `docs/references.md` before publication.
