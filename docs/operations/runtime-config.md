# Runtime configuration operations

Production runtime state and audit history live outside source control.

| Path | Purpose | Permissions |
| --- | --- | --- |
| `/opt/tmc/deploy/runtime-config/production.json` | Current `WEBSITE_DOMAIN` and `META_PIXEL_ID` | `0600` |
| `/opt/tmc/deploy/runtime-config/audit.ndjson` | Append-only change history | `0640` |
| Directory | Runtime config root | `0700` |

Local development and tests use `deploy/runtime-config/` unless `TMC_RUNTIME_CONFIG_DIR` is set.

`config/platform.env` is the **primary/default** source for `WEBSITE_DOMAIN` and `META_PIXEL_ID`. Gitignored `deploy/runtime-config/production.json` (and the VPS copy) holds **fallback** values updated by `config-update` / admin when platform.env keys are empty.

## One-time migration

### 1. Backup (VPS)

```bash
ssh deploy@YOUR_VPS 'sudo mkdir -p /opt/tmc/deploy/runtime-config && sudo cp -a /opt/tmc/deploy/runtime-config /opt/tmc/deploy/runtime-config.backup-$(date +%Y%m%d) || true'
```

### 2. Compile current production config (operator machine)

Ensures `deploy/compiled/production/wallet.env` reflects the currently deployed domain and pixel:

```bash
./deploy.sh production --dry-run
```

### 3. Initialize runtime state

Preferred — seed from compiled artifacts (never reads live `platform.env`):

```bash
./scripts/config-update.sh init \
  --environment production \
  --from-compiled \
  --actor "you@machine" \
  --source MIGRATION
```

Or pass explicit values:

```bash
./scripts/config-update.sh init \
  --environment production \
  --domain exampleUrl.com \
  --pixel YOUR_PIXEL_ID \
  --actor "you@machine"
```

On the VPS, set the runtime directory first:

```bash
export TMC_RUNTIME_CONFIG_DIR=/opt/tmc/deploy/runtime-config
./scripts/config-update.sh init --from-compiled --actor "you@vps"
```

### 4. Copy state to VPS (if init ran locally)

```bash
./deploy/scripts/sync-runtime-config-to-vps.sh
```

Requires `deploy/provider.credentials.env` with `VPS_HOST`, `VPS_USER`, and optional `VPS_SSH_KEY`.

### 5. Verify placeholders and state

```bash
./scripts/config-update.sh status --environment production
grep -E '^(WEBSITE_DOMAIN|META_PIXEL_ID)=' config/platform.env
```

Expect populated runtime state and empty managed placeholders in `config/platform.env` (or keys absent).

## Day-to-day updates

Run from your operator machine (the VPS host does not include Node.js). State defaults to `deploy/runtime-config/` locally; sync to the VPS after init or when restoring.

```bash
npm run config:status
./scripts/config-update.sh history --limit 10
./scripts/config-update.sh domain https://new.example.com --actor "you@machine"
./scripts/config-update.sh pixel 123456789012345 --actor "you@machine"
npm run config:sync-vps   # optional: mirror local state/audit to the VPS
```

Configuration-only releases skip image builds and database migrations. Domain changes restart `caddy`, `backend`, and `wallet`. Pixel changes restart `wallet` only.

## Admin portal

The portal invokes the same CLI via the Nest API. That requires the API process to run on a host with Node.js, the repository `deploy/` tree, and `deploy/provider.credentials.env` for VPS releases.

On the API host:

```env
ADMIN_PRODUCTION_CONFIG_ENABLED=true
TMC_REPO_ROOT=/path/to/trustmycard
```

For the current micro VPS topology (API in Docker, no Node on the host), use the CLI from your operator machine until a host-side runner is added. The synced runtime state at `/opt/tmc/deploy/runtime-config/` is still the authoritative record on the server.

## Actor identity

Use `--actor name@host` on CLI commands. Default: `$USER@$HOSTNAME`. Portal updates record `source=WEB_PORTAL` and the authenticated admin actor.
