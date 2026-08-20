# Runtime configuration

## Source of truth (generated — not in git)

| File | Role |
| --- | --- |
| `production.json` | **Fallback** `WEBSITE_DOMAIN` and `META_PIXEL_ID` when `config/platform.env` is empty |
| `audit.ndjson` | Append-only change history |

These files are **gitignored**. They are created and updated by:

- `./scripts/config-update.sh init|domain|pixel`
- Admin → Platform Configuration (same CLI via Nest API)

On the VPS the same paths live under `/opt/tmc/deploy/runtime-config/` (or set `TMC_RUNTIME_CONFIG_DIR`).

**Do not commit real production domain or Meta Pixel values into the repo.**

## Template (tracked)

`production.template.json` shows the schema with **empty** placeholders. Copy is not required for normal operation — use `config-update init` to create the first live `production.json`.

## Fallback

`config/platform.env` is the **primary/default** source for `WEBSITE_DOMAIN` and `META_PIXEL_ID`. When a key is empty or missing there, the value from `production.json` is used. See `config/platform.env.example`.

## Tests

Tests must set `TMC_RUNTIME_CONFIG_DIR` to a temp directory. They must **not** write into this folder’s `production.json`.
