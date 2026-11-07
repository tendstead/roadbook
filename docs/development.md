# Development and Git flow

## Structure and tooling

Use shopping-list as a reference, without carrying over shopping-specific domain
code, SSE, offline queues or synchronization unless Roadbook's requirements need
them. Go serves `/api/...` and the embedded static SPA. PostgreSQL uses explicit
SQL migrations in `internal/store/migrations`. Node is a build/test dependency,
not a production server. Put optional service adapters behind internal interfaces.

Dependency manifests and lockfiles are committed. Containerized commands match
shopping-list: `deps`, `fmt`, `lint`, `vet`, `vuln`, `test`, `service-test`, `e2e`,
`build`, `up`, `down`, `logs`, and `check`. Use the published `@tendstead/ui`
package, never a sibling checkout link. Run `make hooks` to install pre-commit
formatting, lint/types, and vet checks. Contributors need Docker, Compose, Make,
and pre-commit; Node and Go run in containers.

`make check` and `make app-check` include formatting, Go/frontend lint and types,
Go vet, dependency audits, unit/calculation tests, isolated PostgreSQL tests,
mobile/desktop browser flows, production build and workflow validation. The
Checks workflow runs the same commands. Service/e2e runners create uniquely named
Compose projects and disposable database storage, cleaned up on exit. Unit tests
skip database cases unless TEST_DATABASE_URL is supplied; service-test requires it.

## Branches and review

- `main`: default integration branch; keep releasable once an application exists.
- Short branches: `feat/fuel-log`, `fix/partial-fill-calculation`,
  `docs/product-plan`, `chore/tooling`.
- Branch from current `main`; use a PR back to `main`; review the resulting diff
  and run the relevant checks. No long-lived `develop` branch is needed.
- Use concise imperative commits. Preserve configured author/signing identity;
  never invent a new identity or disable signing to make a commit succeed.
- Squash merge is a proposed default, subject to repository/signing settings.
  Delete merged topic branches. Version tags are created only by Release.
- PR labels are for organization; they do not release images.

Example once an initial baseline commit exists:

```sh
git switch main
git switch -c feat/fuel-log
# implement the agreed slice; verify, commit, then open a PR when authorized
```

The first baseline is committed to main with the existing maintainer signing
identity. Domain/application work then lives on `feat/roadbook-v1`. Git remote
uses the configured `github-alex-heine` SSH alias. Never disable signing to make
a commit succeed. Repository protection settings must be inspected separately;
local configuration is not evidence that GitHub protections are enabled.

## GitHub setup when publication is requested

Create the chosen repository (proposed `tendstead/roadbook`), configure its remote,
push the reviewed baseline, and protect `main`. Require the `Checks / checks`
status, resolved review conversations and PRs; choose review requirements suitable
for a solo-maintained repository. Decide signed commits, merge strategy and
repository visibility explicitly. Verify exact status-check names after CI runs.
These are setup instructions, not settings already applied.

CI uses read-only permissions and runs on PRs, default-branch pushes, and manual
request. Do not grant publishing credentials to PR checks. The inactive release
template and activation steps are documented in deployment.md.
