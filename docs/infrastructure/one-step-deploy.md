# One-step Docker deploy

Provider-independent deployment using OCI images and adapters.

## Quick start (local fresh-host test)

```bash
cp deploy/manifest.production.example.json deploy/manifest.production.json
cp config/platform.env.example config/platform.env
# fill platform.env + profile app env files

chmod +x deploy.sh
./deploy.sh production --fresh --provider local
```

### Micro topology (512 MB VPS prep)

```bash
node deploy/test/micro-topology.test.mjs
./deploy/scripts/validate-micro-local.sh
```

See [deploy/README.md](../../deploy/README.md#wallet-env-websiteenv). On VPS (`docker-vps`), Caddy auto-provisions Let's Encrypt TLS on ports 80/443.

## Safety

- `--fresh` never drops Postgres volumes by default.
- If bundled volume `${compose.project_name}_postgres_data` already exists, deploy aborts unless you pass:
  `--confirm-recreate-data --i-accept-data-loss`
- External `DATABASE_URL` hosts matching `safety.protected_db_hosts` require `--confirm-external-data`.

## Providers

| Provider           | Status                                                              |
| ------------------ | ------------------------------------------------------------------- |
| `local`            | Docker Compose on this machine                                      |
| `docker-vps`       | Build locally → stream images → compose up on VPS (no remote build). Works on DigitalOcean, Hetzner, Hostinger VPS, FlokiNet, etc. |
| `render`           | Stub (not implemented) — use `render-budget.yaml` / `render.yaml` instead |
| `hostinger-static` | Stub (marketing FTP upload)                                         |

VPS provider / droplet migration: [vps-migration.md](./vps-migration.md). DNS + WAF: [cloudflare-setup.md](./cloudflare-setup.md).

See [fresh-host-recovery-test.md](./fresh-host-recovery-test.md).
