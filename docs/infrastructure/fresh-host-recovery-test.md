# Fresh-host recovery test

Assumption: hosting is lost; you still have the git repo and secrets vault (`env/profiles/production/*`).

## Steps

1. Install Docker locally (for local test) or prepare a VPS with SSH access.
2. Restore secrets into `env/profiles/production/` (never commit these files).
3. Copy manifest:
   ```bash
   cp deploy/manifest.production.example.json deploy/manifest.production.json
   ```
4. Run:
   ```bash
   ./deploy.sh production --fresh --provider local
   ```
5. Automated checks:
   - `http://localhost:4000/v1/api/settings/public`
   - `http://localhost:3000/api/settings/public`
   - `http://localhost:3002/login`

## VPS

```bash
cp deploy/provider.credentials.example.env deploy/provider.credentials.env
# fill VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_DEPLOY_PATH

./deploy.sh production --fresh --provider docker-vps
```

## Manual follow-up

- DNS to server IP
- TLS / custom domains
- WalletConnect allowed origin
- Meta / Google Ads consoles

## Data safety

- Default `--fresh` uses **bundled** Postgres in an isolated Docker volume.
- To intentionally wipe that volume:
  `./deploy.sh production --fresh --provider local --confirm-recreate-data --i-accept-data-loss`
