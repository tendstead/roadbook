# Release and deployment foundation

## Match the other application projects

The inspected shopping-list and vision-bill workflows use manual semantic
releases. Follow that pattern, independently of the UI library's npm release flow:

1. Merge reviewed work into the default branch after full application checks.
2. Actions → Release → Run workflow on the default branch; choose patch/minor/major.
3. Verify that exact commit without publishing permissions.
4. In a separate job, reserve annotated `vX.Y.Z`, build Linux AMD64, publish
   `ghcr.io/<owner>/<repository>:X.Y.Z`, and create a GitHub release with its digest.
5. Separately choose to update the running deployment to that exact version/digest.

A merge, label or ordinary push does not publish. Publishing does not deploy.
The image name is derived from GitHub repository context; the proposed name is
`ghcr.io/tendstead/roadbook`. There is no repository or package there created by
this setup. No `latest` image alias is used by the inherited release script.

## Manual release workflow

`scripts/release.mjs` and `scripts/release.test.mjs` are copied unchanged from the
local shopping-list reference. They handle SemVer allocation, dispatch guards,
rerun recovery, registry identity validation, and release ordering.
`.github/workflows/release.yml` adapts that workflow and runs only on an explicit
manual dispatch from the default branch. It verifies the exact commit with
`make app-check`, including locked dependency installation and all application
checks, before a separate job receives publishing permissions. The historical
template under docs/templates remains reference material. Development pushes,
PRs and labels do not dispatch this workflow. No release has been run yet.

Before the first release:

- Verify the multi-stage Dockerfile, embedded frontend, non-root runtime,
  readiness and transactional migration behavior against the release commit.
- Run full app-check and actionlint; review Docker context exclusions and image
  license notices. Retain release-script tests in the full suite.
- Confirm repository/organization permissions allow Actions to create release
  tags, GitHub releases and GHCR packages. Publishing uses short-lived
  `GITHUB_TOKEN`, with `contents: write` and `packages: write` only in publish.
- Choose package visibility explicitly after the first authorized release and
  verify pulling the image from the deployment host.

With no tags, a patch release begins at `0.0.1`, a minor at `0.1.0`. Reservations
can survive a failed release: rerun the original failed workflow to reuse its
version; do not delete reservation tags or overwrite published images. A new
manual dispatch intentionally allocates a new version. GHCR/GitHub permissions
and an actual publication have not been verified for Roadbook.

## Independent runtime

Use `compose.yaml` for the runnable bundled PostgreSQL stack, or
`compose.external.yaml` with DATABASE_URL for an existing dedicated database/role.
The historical example under docs/templates is reference material only. The
binary is `/app/roadbook`; `-healthcheck` calls readiness. `/api/health` is liveness,
and `/api/ready` checks PostgreSQL. Startup applies versioned SQL migrations in a
transaction under an advisory lock; failed migrations prevent startup.

Use a multi-stage Node → Go → non-root runtime image with embedded SPA assets.
Choose port 8082 on loopback as the local default to reduce overlap with
existing apps; verify actual availability when deploying. Default to private
access pending the auth decision. PostgreSQL has no host port, with a dedicated
Roadbook database/user and persistent volume. An existing PostgreSQL server can
be supported through a separate configuration with its own Roadbook role/database;
never use vision-bill's schema or credentials.

The example starts with shopping-list-like CPU/RAM limits, to be measured and
adjusted for Roadbook. Give build/test containers separate limits and names.
Do not attach existing production volumes to tests. Keep secrets out of images,
Git and frontend bundles; decide file-based production secrets during implementation.

## Recovery and operations to complete before real use

Define migration/rollback compatibility and back up the database before upgrades.
If Roadbook owns receipt files, back those up consistently too. Test restore into
an isolated database, verify totals/record counts, retain the previous image
reference, and document the deployment host's paths. An older image may not work
with a newer schema: rolling back an image alone is not a universal recovery plan.
Never use `docker compose down -v` on a real data stack as an upgrade procedure.

Local test images are built by verification. No image is published or real service
deployed as part of development. Existing sibling services remain untouched.

## Phone testing on the local network

Set `ROADBOOK_BIND=0.0.0.0` (or a specific LAN interface address) in the ignored
`.env`, then run `docker compose -p roadbook up -d --build --no-deps app`.
The default remains `127.0.0.1`. Open `http://<host-LAN-IP>:8082` from a phone on
that network; `ROADBOOK_PORT` can select another port. This changes Roadbook's
HTTP publication only; PostgreSQL remains private to the Docker network.

This passwordless installation allows reachable users to switch profiles. Limit
LAN access to trusted devices; HTTP does not encrypt records or sessions. No host
firewall, router forwarding or sibling-service configuration is changed here.
