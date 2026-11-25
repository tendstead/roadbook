# Optional vision-bill Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect authenticated Roadbook users to their own restricted vision-bill
receipt queue and document images, preserving standalone use and local history.

**Architecture:** Separate application sessions and per-user opaque integration
tokens. Roadbook owns reviewed vehicle records; vision-bill owns accepted remote
receipt originals/previews. A bounded server-side adapter handles upload, polling,
authorized image streaming and durable recovery. No SSO or shared data stores.

**Tech Stack:** Existing Go/PostgreSQL/Svelte 5/TypeScript Roadbook stack;
vision-bill changes belong in its own authorized session and repository.

**Spec:** `docs/vision-bill-v1.1-plan.md` (ownership, authentication direction,
HTTP deployment constraints and optional later LLM capability).

**Status:** Planning only. No service changes, endpoint availability, migration,
publication or deployment are implied. Agree the cross-project contract before
executing adapter tasks. The account/session prerequisite needs a separate design.

## Global Constraints

- Support independent hosts and ordinary HTTP LAN IP addresses.
- Recommend HTTPS; HTTP cannot protect credentials against network interception.
- No shared schema, credentials, source checkout, browser session, or filesystem.
- Never infer odometer or tank fullness from a receipt.
- Vision-bill and shopping-list remain read-only in this task.
- No API secrets in browser storage, URLs, logs, normal exports, Git or fixtures.
- No automatic merge, release or deploy; exact money/unit rules remain in Roadbook.

## Review Focus

- Switching a selectable profile must never select another account's token.
- Receipt IDs and UUIDs are references, not authorization grants.
- A lost upload response must not create a duplicate or lose the local original.
- Cross-host redirects must not leak credentials; target configuration is admin-only.
- Remote outage/revocation must not erase history or relax authentication.

## Task 1: Agree API and authenticated-account prerequisites

**Files:**
- Update: `docs/vision-bill-v1.1-plan.md`, `docs/api.md`, `docs/design.md`.
- Create: `docs/vision-bill-api-contract.md` after current-source inspection.
- Separate deliverable: reviewed Roadbook account/session design and migration plan.

**Interfaces:** Contract must define connection identity, token scopes, upload
acceptance and idempotency, receipt/job identifiers, processing/review states,
field values with currency/units, thumbnails/originals, errors and expiry behavior.
Do not assign paths in vision-bill before inspecting its current owning modules.

- [ ] In a separately authorized vision-bill session, inspect current auth,
  upload queue, receipt ownership, image routes and duplicate handling.
- [ ] Agree exact request/response examples using synthetic documents only.
- [ ] Define receipt ownership versus per-connection grants; list explicit 401,
  403/404, 413, 429 and retryable failure behavior.
- [ ] Design real Roadbook authentication, account-to-profile mapping, existing
  record migration, password/session recovery and credential encryption-key storage.
  Validate 30-day remembered sessions, CSRF controls, login throttling and no
  profile-switch impersonation. Standalone passwordless mode cannot expose private
  per-user connections. Do not change modes automatically on failure.
- [ ] Resolve originals on disconnect/deletion and opt-in migration of existing
  local attachments. Initial recommendation: no bulk migration; offer a deliberate
  download/relocalization operation before permanent disconnect.
- [ ] Verify contract examples and account migration tests before adapter code.

## Task 2: Add restricted tokens and receipt grants in vision-bill

**Files:** Exact auth/token/storage/receipt/test modules identified in Task 1,
implemented only in vision-bill's own authorized session.

**Interfaces:** Authenticated token issuance/revocation; bearer-authenticated
receipt operations defined by Task 1. Each request resolves owner + connection +
scope, then checks the document grant. Browser login sessions remain separate.

- [ ] Write failing tests for invalid, expired and revoked tokens; missing scope;
  another user's receipt id; same user's different connection without a grant;
  and denial of archive listing/deletion/admin operations.
- [ ] Implement random opaque-token issuance, hashed storage, expiry, revocation,
  safe last-use metadata and one-time secret display using existing auth patterns.
- [ ] Apply owner/grant checks consistently to jobs, results, thumbnails and originals.
- [ ] Implement duplicate-safe upload acceptance keyed by connection + caller key.
  Distinguish durable source acceptance from analysis completion.
- [ ] Run owning service unit/API tests and cross-user authorization tests. Return
  the agreed contract and verified capabilities to the Roadbook task.

## Task 3: Store connections and implement a bounded Roadbook adapter

**Files:**
- Create: `internal/visionbill/client.go`, `internal/visionbill/client_test.go`.
- Create: `internal/store/connections.go`, `internal/httpapi/connections.go`.
- Create: next numbered migration in `internal/store/migrations/`.
- Modify: authenticated API wiring and settings modules established by Task 1.

**Interfaces:** Adapter operations implement the agreed contract for connection
validation, upload, status/results and image retrieval. Accept context cancellation;
credentials never reach frontend response models. Connection lookup takes the
authenticated account, never a caller-supplied profile alone.

- [ ] Write failing adapter tests with `httptest` and synthetic payloads for
  timeouts, invalid responses, size limits, redirects and revoked credentials.
- [ ] Add encrypted credential storage and authenticated connect/test/disconnect
  endpoints; redact secrets in logs/errors/export and provide rotation support.
- [ ] Permit only administrator-configured destinations; explicitly configure
  HTTP mode, preserve TLS verification, reject host-changing redirects and
  unsupported URL schemes. No arbitrary URL-fetch endpoint.
- [ ] Implement request/response limits, timeouts, context cancellation and safe
  retry classification. Test that secrets cannot be redirected to a second server.
- [ ] Run adapter, account-access and database migration tests; verify switching
  `X-Roadbook-Profile` cannot access a different account's connection.

## Task 4: Durable upload queue and reviewed extraction drafts

**Files:**
- Create: `internal/store/receipt_transfers.go`, next numbered migration.
- Create: `internal/httpapi/receipt_transfers.go` and isolated service tests.
- Modify: attachment/upload handlers, `web/src/lib/Attachments.svelte`,
  `web/src/lib/EntryForm.svelte`, settings connection UI and translation dictionaries.

**Interfaces:** Transfer states distinguish locally pending, durably accepted,
processing, ready for review and failed. Persist a stable idempotency key before
the first network attempt. Draft results use canonical Roadbook values plus
source receipt/line/revision references, not automatic saved records.

- [ ] Write failing tests for restart during upload, lost acceptance response,
  temporary remote failure and repeated retry without duplicate receipts.
- [ ] Persist pending originals until durable acceptance and remote references
  are committed locally. Queue retries with bounded backoff; do not block manual use.
- [ ] Present extracted date/merchant/amount/volume/category candidates for review.
  Keep unknown odometer/fullness; validate explicit units and mixed-receipt lines
  so groceries are not counted as fuel. Preserve source revision metadata.
- [ ] Test account isolation, exact monetary/unit conversion and explicit user
  save. Verify corrections do not silently synchronize either service's records.

## Task 5: Authorized image display, recovery and acceptance

**Files:**
- Modify: `internal/httpapi/attachments.go`, attachment store/service tests,
  `web/src/lib/Attachments.svelte`, relevant mobile/desktop browser tests.
- Update: `docs/deployment.md`, `docs/recovery.md`, `docs/api.md`.

**Interfaces:** Existing Roadbook attachment URLs route local or remote storage
behind authenticated account/vehicle checks. Lists fetch only thumbnails;
originals require explicit open/download. Remote credentials never enter URLs.

- [ ] Write failing tests for cross-user image access, revoked tokens, remote
  outage, thumbnail failure and no original downloads during history listing.
- [ ] Stream bounded image responses through the authenticated backend; enforce
  safe content types, private caching and access checks before serving cached data.
- [ ] Add visible pending/unavailable states without removing reviewed entries.
  Verify disconnect stops remote access and does not delete vehicle records.
- [ ] Document HTTP risks, HTTPS proxy setup, token rotation, credential-key backup,
  independent DB/image backups and the agreed disconnect/export behavior.
- [ ] Run `make check` and `make app-check`; run adapter tests against a real
  authorized vision-bill test deployment as a separate acceptance step. Validate
  LAN HTTP IP addresses and HTTPS, session expiry/revocation, two different users,
  restart recovery and mobile/desktop receipt viewing. No production-data fixtures.

## Deferred: mapping suggestions

Receipt integration does not require LLM proxying. A later capability may add a
separate scoped structured-suggestion endpoint with numbered headers/sample cells,
Roadbook-owned response validation, provider disclosure and bounded concurrency.
Keep manual CSV import usable without that endpoint or either service connection.
