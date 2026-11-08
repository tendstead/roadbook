# Guided CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved local CSV mapping workspace and empty-history banner.

**Architecture:** A pure TypeScript inspection/conversion module produces two
unsaved sample records. A shared entry-summary component renders samples and
persisted history. Existing server preview and commit remain authoritative.

**Tech Stack:** Svelte 5, TypeScript, Go, PostgreSQL; existing container tooling.

**Spec:** `docs/superpowers/specs/2026-11-08-import-workspace-design.md`.

## Global Constraints

- Keep file inspection and immediate mapping examples entirely in the browser.
- Preserve exact money, integer metres/millilitres and explicit source formats.
- Preserve existing staged language changes and English/German behavior.
- No vision-bill edits, LLM networking, authentication or statistics-policy changes.
- No private exports in Git, Docker context or fixtures.

## Review Focus

- Quoted multiline fields, trailing blank lines and limits must agree with server CSV interpretation.
- Date ambiguity and invalid calendar dates must never be silently normalized.
- Mapping/context changes during a preview request cannot resurrect stale review.
- Mobile/keyboard users must be able to map without native drag-and-drop.
- Preview cards must not fetch attachments or display invalid values as valid.

## Task 1: Exact local examples and source date formats

**Files:** Create `web/src/lib/import-preview.ts` and its Vitest tests; extend
`internal/domain/import.go` and `internal/domain/import_test.go` date formats.
**Interfaces:** `inspectCSV(source, delimiter): string[][]` validates limits;
`previewRows(cells, spec): LocalPreview[]` returns at most two source-numbered
entries/issues; `ImportConfig` carries explicit units/formats/mappings/range.

- [x] Write failing tests for exact localized values, source units, invalid dates,
  unknown measurements, table ranges, CSV limits and additional date patterns.
- [x] Observe failures, implement conversion with BigInt rational arithmetic,
  and extend server date patterns consistently.
- [x] Run frontend unit suite and Go domain tests.

## Task 2: Shared entry presentation and mapping workspace

**Files:** Create `web/src/lib/EntrySummary.svelte`; modify History, Importer,
Settings, translations and scoped workspace styles. Add `web/tests/import-workspace.spec.ts`.
**Interfaces:** EntrySummary consumes an Entry and installation Settings only;
no storage, attachment requests or history actions. Importer uses Task 1 examples.

- [x] Write failing mobile/desktop browser flows for file selection/drop, source
  samples, drag/click/select mappings, live examples and absence of preview requests.
- [x] Extract shared display, build accessible field groups and explicit source
  controls; preserve the existing selected-row review table and schedule behavior.
- [x] Invalidate review on all mapping/source/context changes; guard in-flight
  responses and commit against the reviewed configuration. Test these transitions.
- [x] Run unit, type/lint and targeted real browser tests.

## Task 3: Discovery, full verification and delivery

**Files:** Modify layout banner and Settings anchor, browser tests and docs.
**Interfaces:** Banner eligibility derives from loaded profile records and path/hash;
first saved entry/import removes it, deleting all records makes it eligible again.

- [x] Observe failing banner lifecycle/prerequisite/anchor browser cases, implement
  the banner and vehicle setup link, and verify German/mobile presentation.
- [x] Run `make check` and `make app-check`; inspect application UI and review diff.
- [x] Obtain one independent whole-change review; resolve material findings.
- [x] Preserve prior staged language work in its own signed prerequisite commit;
  commit importer and planning changes separately, then push the feature branch.

## Verification record — 2026-11-08

`make check` and `make app-check` passed, including 19 frontend unit tests,
26 desktop/mobile browser cases, Go race/service tests, production build,
backup/restore verification and workflow lint. Four low-severity frontend audit
findings remain; the configured high-severity gate passed. Independent review
found two local/server preview mismatches; both were reproduced with failing
regression tests and fixed. Desktop/mobile screenshots were inspected.

Delivery uses signed commits on `feat/roadbook-v1`. The original staged language
snapshot was preserved as its own prerequisite commit (`aa35f12`). Importer
implementation and vision-bill planning are separate changes. Signing and commit
hooks remain enabled.
