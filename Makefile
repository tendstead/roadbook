TOOLS = docker compose -p roadbook-tools -f compose.tools.yaml
export LOCAL_UID := $(shell id -u)
export LOCAL_GID := $(shell id -g)
.PHONY: help deps fmt fmt-check lint vet vuln test service-test e2e build up down logs check app-check release-test workflow-lint hooks
help:
	@echo "Roadbook: deps fmt lint vet test service-test e2e build check up down logs hooks"
deps:
	$(TOOLS) run --rm go go mod download
	$(TOOLS) run --rm frontend npm ci
fmt:
	$(TOOLS) run --rm go gofmt -w cmd internal
	$(TOOLS) run --rm frontend npm run format
fmt-check:
	$(TOOLS) run --rm go sh -c 'test -z "$$(gofmt -l cmd internal)"'
	$(TOOLS) run --rm frontend npx prettier --check .
lint:
	$(TOOLS) run --rm lint golangci-lint run
	$(TOOLS) run --rm frontend npm run lint
	$(TOOLS) run --rm frontend npm run check
vet:
	$(TOOLS) run --rm go go vet ./cmd/... ./internal/...
vuln:
	$(TOOLS) run --rm go go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./cmd/... ./internal/...
	$(TOOLS) run --rm frontend npm audit --audit-level=high
test:
	$(TOOLS) run --rm go go test -race -count=1 ./cmd/... ./internal/...
	$(TOOLS) run --rm frontend npm test
	$(MAKE) release-test
service-test:
	sh scripts/test-containers.sh service
e2e:
	sh scripts/test-containers.sh e2e
build:
	docker build --platform linux/amd64 -t roadbook:local .
up:
	docker compose -p roadbook up -d --build --wait
down:
	docker compose -p roadbook down
logs:
	docker compose -p roadbook logs -f --tail=100
check: fmt-check lint vet vuln test service-test e2e build workflow-lint
app-check: check
release-test:
	$(TOOLS) run --rm frontend node --test /app/scripts/release.test.mjs
workflow-lint:
	docker run --rm --cpus 1 --memory 128m -v "$(CURDIR):/repo:ro" -w /repo rhysd/actionlint:1.7.12 -no-color .github/workflows/checks.yml
hooks:
	pre-commit install
