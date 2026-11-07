# Reference observations

Inspected read-only on 2026-11-07 in this workspace. These are observations of
local checkouts, not claims about remote default branches or a running deployment.

- `../shopping-list` at `fd31ec9` (`feat/manual-ghcr-releases`):
  `AGENTS.md`, `README.md`, `go.mod`, `web/package.json`, `Dockerfile`,
  `compose.yaml`, `compose.external.yaml`, `compose.tools.yaml`, `Makefile`,
  `.github/workflows/checks.yml`, `.github/workflows/release.yml`,
  `docs/releases.md`, and `scripts/release{,.test}.mjs`.
- `../vision-bill` at `3be3cd8` (`feat/shared-ui-release`):
  `AGENTS.md` and `.github/workflows/release.yml` establish its existing auth,
  independent service structure, and matching manual GHCR release pattern.
  Untracked work was present. No files or Git state were changed there.
- `../ui`: `package.json`, `src/lib/index.ts`, and shopping-list's shell usage
  establish published `@tendstead/ui` / `AppShell` / theme integration.

The two release JavaScript files are unchanged local copies from shopping-list;
release workflow setup is adapted from the same source. No shopping-specific
application code was copied. No license file was found in the shopping-list
reference search. Inspection of the release scripts' Git history lists Alexander
Heinecke as their sole recorded author. The user's request to reuse their tooling
and apply Elastic License 2.0 is the permission basis for including that tooling
here under ELv2; retain this source provenance. This does not change the license
of shopping-list, vision-bill, or any third-party dependency.

The root `LICENSE` is the unmodified Elastic License 2.0 text obtained from
`https://raw.githubusercontent.com/elastic/elasticsearch/main/licenses/ELASTIC-LICENSE-2.0.txt`.
Third-party dependencies retain their own licenses; audit and preserve required
notices when implementation selects dependencies.

No live vision-bill integration contract, remote repository state, registry image,
package version availability or deployment infrastructure was verified. Reinspect
actual interfaces and toolchain compatibility at implementation time.
