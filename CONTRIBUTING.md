# Contributing

Read `AGENTS.md` and `docs/design.md` first. Roadbook uses short branches and PRs
against main, with signed commits. Keep changes focused and explain the user
problem and verification. AI-assisted contributions need the same review and
tests as any other contribution; disclose assistance in the PR template.

Build tools run in Docker. Run `make deps`, `make hooks`, then `make check` before
submitting. Hooks require pre-commit installed locally and run formatting, lint,
types and Go vet. Unit tests run with `make test`; PostgreSQL/API tests with
`make service-test`; browser tests with `make e2e`. All service tests use disposable
Roadbook containers. Never attach real database volumes or use personal receipts
as fixtures. Use synthetic inputs and keep credentials out of reports.

Original Roadbook material is licensed under Elastic License 2.0. Contributions
must be yours to submit and include any necessary third-party notices. No copyright
assignment or additional relicensing rights are implied by opening a PR.

Do not edit sibling applications or shared infrastructure as part of a Roadbook
change. Publishing images and deploying are separate, explicit operations.
