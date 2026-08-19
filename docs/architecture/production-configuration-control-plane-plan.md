# Production Configuration Control Plane — Implementation Plan

## Purpose and scope

Build a single, auditable production-configuration control plane in two phases.

- Phase 1 creates the reusable, privileged configuration-management engine and its CLI.
- Phase 2 connects the approved `index.html` mockup to that same engine through secure, explicit backend operations.

This plan does not authorize a deployment. It also does not change existing application behavior outside the configuration path.

## Architectural decisions

### Separate declaration from current production state

`config/platform.env` will declare these keys permanently as empty placeholders:

```env
WEBSITE_DOMAIN=""
META_PIXEL_ID=""
```

It will never be read as the current production value after the one-time migration. A non-empty value is a safety violation and blocks every update, regardless of whether the caller is the CLI or the portal.

Use one durable, deployment-local runtime state file outside source control, for example under the deployment root:

```text
/opt/tmc/deploy/runtime-config/production.json
/opt/tmc/deploy/runtime-config/audit.ndjson
```

The exact remote path will be centralized in the engine. The local development equivalent will be configurable for tests. The state file holds the current values, schema version, and latest change metadata; the append-only audit log holds every attempt and result. Neither is copied from the repository during normal deployment.

### One engine; two interfaces

Create a small Node module in the existing deployment system that owns:

1. state read/write and schema checks;
2. authoritative domain and pixel validation;
3. `platform.env` placeholder safety validation;
4. preflight validation and compiled-config generation;
5. configuration-only release, verification, rollback, audit, and structured events.

The CLI is a thin adapter that parses arguments and renders engine events. Phase 2 backend endpoints invoke the same explicit engine methods. No browser endpoint may expose shell, SSH, Docker, or arbitrary command execution.

### Reuse the existing deployment architecture

The existing compiler, generated env bundles, generated Caddyfile, Docker Compose configuration, VPS adapter, and verification flow remain the foundation. Add a configuration-only path that:

- uses current runtime state as the compiler input for the domain and pixel values;
- writes only generated runtime configuration;
- transfers only the required generated configuration/compose artifacts;
- restarts or reloads only affected services;
- skips image builds and database migrations unconditionally;
- performs existing relevant health checks against the new public domain.

The engine must emit explicit events: `CONFIGURATION-ONLY DEPLOYMENT`, `Docker image rebuild: SKIPPED`, and `Database migration: SKIPPED`.

## Phase 1 — Configuration management engine

### 1. Establish runtime state and migration boundaries

1. Define a versioned runtime-state schema with `WEBSITE_DOMAIN`, `META_PIXEL_ID`, last change ID, timestamp, and source.
2. Define an audit-record schema: change ID, key, prior/requested/final values, actor, source, timestamps, validation/deployment/rollback results, and error details safe for logs.
3. Add atomic state writes (temporary file plus rename), restrictive file permissions, and append-only audit writes.
4. Add a one-time, explicit initialization/migration command only if needed to seed the runtime state from the currently deployed configuration. It must not silently seed from a later non-empty `platform.env`.
5. Set the two `platform.env` values to empty only after state initialization is verified. Keep unrelated platform secrets and settings unchanged.

### 2. Implement the reusable engine

Introduce explicit operations only:

```text
getProductionConfig()
getConfigHistory()
updateWebsiteDomain(request)
updateMetaPixelId(request)
```

Each update follows one transaction-like workflow:

1. Allocate a unique `CFG-YYYYMMDD-NNNNNN` change ID.
2. Emit structured `read`, `validation`, `preflight`, `apply`, `restart`, `verify`, `rollback`, and `complete` events.
3. Read the current runtime state and preserve a rollback snapshot.
4. Verify `platform.env` has empty `WEBSITE_DOMAIN` and `META_PIXEL_ID`; fail before any modification if not.
5. Validate only the requested key using shared validators.
6. Compile candidate runtime configuration from the candidate state.
7. Run applicable preflight checks, including generated configuration/Caddy syntax checks where supported by the existing environment.
8. Apply the candidate state and generated configuration through the configuration-only deployment path.
9. Restart/reload only services affected by the change, then run production health checks.
10. On success, finalize the audit record with `SUCCESS`.
11. On any apply or verification failure, restore the saved state, regenerate the prior configuration, restart/reload affected services, verify prior health, and record the rollback outcome.

Concurrency protection is required: use a single local lock around a production update so two CLI/portal requests cannot interleave state, release, or rollback work.

### 3. Shared validation rules

Implement these validators in the engine module, never only in the CLI or frontend.

| Value | Required validation |
| --- | --- |
| Website domain | Accept only an HTTPS origin with a valid DNS hostname; reject HTTP, localhost, IP literals, wildcard hosts, paths, query strings, fragments, malformed hosts, and unsupported protocols. Normalize accepted input to the canonical origin used by the compiler. |
| Meta Pixel ID | Require the expected numeric Meta Pixel ID form; reject empty, arbitrary text, and malformed IDs. |
| Platform declaration | Require both placeholder keys to be present and empty before any update. |

The portal may repeat lightweight validation for user experience, but must display the engine's authoritative result.

### 4. Compiler and deployment integration

1. Change compiler inputs so runtime state takes precedence for the two managed production values; do not fall back to non-empty source-controlled values.
2. Preserve existing generated destinations: public website/API origins, Caddy hostnames, `APP_ORIGIN`, public app URL, Pixel app URL, and intended internal Docker service URLs.
3. Add an explicit configuration-only adapter/orchestrator method rather than routing through the full build/migration deployment flow.
4. Restrict transfer/release to the generated configuration files and required Compose/Caddy artifacts; do not transfer images unless a future technical requirement is documented.
5. Reuse the existing health-check mechanism where possible; add only checks directly required for the managed value.
6. Ensure every generated artifact derives from one runtime-state snapshot so a domain/pixel update cannot produce mixed versions.

### 5. CLI

Add a discoverable script wrapper around the engine:

```sh
./scripts/config-update.sh --help
./scripts/config-update.sh status
./scripts/config-update.sh history
./scripts/config-update.sh domain https://example.com
./scripts/config-update.sh pixel 123456789012345
```

The wrapper provides actor identity from an explicit option or a safe local default, sends `source=CLI`, and renders structured engine events. Its help must document supported keys, input formats, validation, state location, configuration-only deployment behavior, rollback, and inspection commands.

### 6. Phase 1 test plan

Use dependency injection/fakes for filesystem, deployment adapter, clock/change-ID source, and health verification so tests never contact production.

Automated coverage must include:

1. valid domain update;
2. invalid, HTTP, localhost, IP, and path-bearing domains;
3. invalid/empty/malformed Pixel IDs;
4. non-empty `WEBSITE_DOMAIN` and non-empty `META_PIXEL_ID` placeholders blocking updates;
5. successful state update, generated configuration, configuration-only release, and audit record;
6. deployment failure followed by rollback and prior-health verification;
7. audit records for success and failure with `source=CLI`;
8. no Docker image build and no database migration in the configuration-only path;
9. event sequence and change-ID consistency;
10. lock/concurrent-update rejection or serialization;
11. status and history output based on runtime state/audit data, not `platform.env`.

Run existing formatter, linter, deployment/configuration tests, and the new engine tests. Do not deploy as part of automated tests.

### Phase 1 acceptance handoff

Before Phase 2, provide the files changed, runtime-state location and permissions, architecture, CLI commands and sample output, tests run, rollback demonstration, and proof that `platform.env` still has both managed values empty. Stop for approval before any UI work.

## Phase 2 — Approved configuration portal

Phase 2 starts only after Phase 1 is accepted and the approved `index.html` reference is available for visual comparison.

### 1. Backend integration and authorization

1. Use the existing admin authentication/authorization architecture to grant a narrowly scoped configuration-management permission.
2. Add authenticated endpoints for current configuration, audit history, starting an explicit domain/pixel update, and streaming that update's events.
3. The endpoints call the Phase 1 engine methods; they never accept arbitrary commands or expose credentials, private keys, Docker, SSH, or shell access.
4. Record `source=WEB_PORTAL` and the authenticated actor in the existing audit format.
5. Implement a simple event stream (prefer Server-Sent Events unless an existing project mechanism is a better fit) that sends actual engine events and change IDs.

### 2. Portal implementation from the approved mockup

1. Locate the correct admin frontend route and translate the approved `index.html` layout, spacing, typography, colors, modals, validation states, terminal presentation, success/failure/rollback states, and activity UI without redesigning it.
2. Load current runtime values from the backend, never from `platform.env`.
3. Apply client-side validation only for immediate feedback; submit to the authoritative backend engine.
4. Render live engine events in the terminal/log UI, clearly showing validation, configuration-only deployment, verification, success, failure, and rollback.
5. Populate Recent Activity from actual audit records, including actor, source, previous/new values, timestamp, result, and change ID.
6. Keep secrets and privileged deployment mechanisms exclusively on the server/VPS side.

### 3. Deployment boundary

Evaluate a separately hosted frontend only after the backend authorization and engine boundary are proven. A hosted portal may call a secured backend on the existing infrastructure, but no privileged deployment credentials move into browser code or a static host. Do not modify the existing production application's deployment merely to host the portal.

### 4. Phase 2 verification

Test the approved scenario end-to-end in a non-production/fake-adapter environment:

1. Empty source placeholders with initialized runtime state.
2. CLI domain update and audit event.
3. Portal displays the new current value, performs an update, streams real events, and records `WEB_PORTAL` history.
4. A simulated verification failure triggers rollback and leaves the previous runtime state healthy.
5. Browser receives no deployment credentials or secrets.

## Implementation order

1. Confirm the runtime-state storage path, ownership, backup policy, and actor identity convention.
2. Build and test the Phase 1 engine locally with a fake deployment adapter.
3. Integrate compiler/orchestrator configuration-only behavior and test it without production access.
4. Perform the explicit one-time runtime-state initialization and placeholder transition only with deployment approval.
5. Verify Phase 1 acceptance criteria and obtain approval.
6. Implement Phase 2 backend authorization/event streaming.
7. Implement the approved portal UI and run visual/functional verification.
8. Decide and execute a separate portal deployment only after security review and explicit approval.

## Non-goals and safeguards

- No generic command execution endpoint.
- No database, Kubernetes, Terraform, workflow platform, or unrelated infrastructure addition unless later proven necessary.
- No image rebuild, dependency rebuild, or database migration for a configuration update.
- No modification of unrelated runtime behavior.
- No production deployment, SSH, DNS, Docker, or Caddy action occurs while implementing or testing this plan without explicit authorization.
