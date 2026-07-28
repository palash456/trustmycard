# Scripts

## `stop-dev.mjs`

Stops dev servers and clears stale Next.js lock files before restart.

Run from **`frontend/`**:

```bash
node scripts/stop-dev.mjs website
node scripts/stop-dev.mjs admin
node scripts/stop-dev.mjs backend
node scripts/stop-dev.mjs all
```

Or use npm scripts: `npm run dev:stop`, `npm run dev:website:reset`.

## Dev ports

| App     | Port |
|---------|------|
| website | 3000 |
| admin   | 3002 |
| backend | 4000 |

Backend uses **4000** (not 3001) so a stuck website process never collides with the API.
