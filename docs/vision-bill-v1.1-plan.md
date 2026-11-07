# v1.1 — optional vision-bill connection

Updated 2026-11-07. Planning record and API proposal, not an approved API contract
or a claim about implemented capabilities. Keep vision-bill and shopping-list
read-only in this task; agree any changes in their own sessions.

## Ownership and independence — agreed direction

- Roadbook remains independently deployable and usable without vision-bill.
  No shared schema, credentials, source checkout, browser session, or filesystem.
- Roadbook always owns dashboard photos and persistent thumbnails.
- Without integration, Roadbook owns receipt/bill originals and thumbnails too.
- With integration, send receipts and bills to vision-bill for analysis and
  inclusion in its normal receipt list. vision-bill permanently owns those source
  images and previews, made accessible to both services through its API.
- Roadbook retains reviewed vehicle-record values: date, amount, volume where
  relevant, distance, tank status, category, payer, and source references. Do not
  copy the full receipt model or permanently duplicate integrated receipt images.
- Correcting either record does not silently rewrite the other. Offer explicit
  review of changed source values; no background bidirectional synchronization.
- A vision-bill outage must not remove Roadbook's history, totals, or consumption.
  Integrated receipt images/source details may be unavailable; show that clearly.
  An outage itself is not deletion, but backup/restore is still necessary.

## Upload, outage, and recovery behavior

- With no configured integration, process attachments entirely in Roadbook.
- With a configured but unreachable integration, show a persistent global warning
  while unavailable. Keep manual entries fully usable.
- Durably retain pending receipts, source metadata, and transfer status locally
  across Roadbook restarts. Retry when vision-bill becomes reachable.
- Use vision-bill's analysis queue through its API; do not share queue tables or
  implement a second copy of its analysis worker.
- Duplicate-safe upload retries must recover from an uncertain response without
  creating another receipt. Temporary local files may be removed only after
  confirmed durable acceptance and recorded remote references. Analysis completion
  is a separate state and need not block safe transfer completion.
- Never infer odometer or tank fullness from a receipt. Present extracted date,
  merchant, amount, volume/unit candidates for review before saving vehicle data.
- List views request small persistent thumbnails only. Images remain accessible
  through a stable Roadbook attachment interface regardless of storage owner.

## General receipt-service API proposal

Design for more than Roadbook. Shopping-list is another intended consumer:
upload a visited store's receipt from a shopping trip, then compare planned items
against purchased line items. That work is not part of Roadbook v1.0.

- Support upload, durable acceptance, processing status, reviewed receipt and
  line-item retrieval, thumbnails/originals, and controlled receipt updates.
- Keep domain-specific vehicle/shopping logic in consumers. A common upload
  experience may be useful, but API design must not depend on one shared UI.
- Scoped, revocable tokens tied to a vision-bill user, with per-resource access
  checks. Store credentials server-side. Do not store account passwords or reuse
  browser session cookies as the integration contract.
- Stable receipt and line-item IDs, source revisions, caller references, and
  duplicate-safe retry keys. Several applications may link to one receipt.
- A receipt may contain fuel and groceries: consumers can reference selected
  lines without treating the full receipt total as each application's expense.
- Expose clear queued, processing, review, completed, and failed states, with
  documented error/retry behavior. Final wire names remain to be agreed.
- Explicit change detection supports user-reviewed updates. Deletion must account
  for linked consumers while preserving their independent reviewed records.
- Preserve stable references across host URL changes and backup restoration.

## Current observed feasibility and unresolved decisions

Read-only inspection found receipt upload, queued analysis, receipt retrieval,
originals, thumbnails, and cookie-based authentication. No dedicated integration
token mechanism was found. Fuel line-item quantities do not establish explicit
fuel units or reliable odometer/tank information. Reinspect the current owning
source when agreeing the contract: vision-bill is under concurrent development.

Before implementation, settle token scopes and user/profile mapping, deployment
transport, idempotency and revisions, linked-receipt deletion, status/error shapes,
original ownership and temporary retention, and handling of existing Roadbook
receipts when enabling/disabling integration. Existing-image migration is not
yet agreed. Do not promise unsupported endpoints or modify vision-bill here.

Verify manual operation with integration absent; timeout/outage warnings; restart
recovery; duplicate-safe transfers including lost acknowledgements; review and
unit validation; source edits/deletion; token revocation and cross-user access;
mixed receipts and multiple consumer links; thumbnail-only lists; and independent
backup/restore. Use synthetic receipts and an API stub for Roadbook's tests.
