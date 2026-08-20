# Website i18n / locale sync

English is the source of truth. Other languages are generated from English — do not hand-edit every `locales/*.json` file.

## Source files

| File | Role |
| --- | --- |
| `frontend/website/scripts/_locale-data/en.mjs` | English site + wallet strings (`buildEnLocale()`, `EN_WALLET`) |
| `frontend/website/scripts/_locale-data/translatable-strings.json` | Flat list of site strings synced from English (excluding wallet-only keys) |
| `frontend/website/scripts/_locale-data/translation-arrays/*.json` | Per-locale translations aligned 1:1 with `translatable-strings.json` |
| `frontend/website/scripts/_locale-data/wallet-*.mjs` | Wallet modal strings per locale |
| `frontend/website/locales/*.json` | **Output** consumed by the website at runtime |

Supported locales: `en`, `es`, `de`, `fr`, `ko`, `ja`, `pt`, `ar`, `hi`, `tr`, `ru`, `uk`, `zh`.

## Sync workflow

From repo root:

```bash
cd frontend/website/scripts/_locale-data

# 1. After editing en.mjs — re-sync site string list (if site copy changed)
node -e "
import { buildEnLocale } from './en.mjs';
import { writeFileSync } from 'fs';
function collect(o, s=new Set(), skip=new Set(['href','id','flag','percent','address'])) {
  if (typeof o==='string') { s.add(o); return s; }
  if (Array.isArray(o)) { o.forEach(x=>collect(x,s,skip)); return s; }
  if (o&&typeof o==='object') Object.entries(o).forEach(([k,v])=>{ if(!skip.has(k)) collect(v,s,skip); });
  return s;
}
const en=buildEnLocale(); delete en.wallet;
writeFileSync('translatable-strings.json', JSON.stringify([...collect(en)].sort(),null,2)+'\n');
"

# 2. Auto-translate site strings (Google Translate via deep_translator)
python3 auto-translate-locales.py

# 3. Auto-translate wallet strings
node export-en-wallet.mjs
python3 auto-translate-wallets.py

# 4. Fix strings that still match English
python3 fix-english-leftovers.py

# 5. Build final locale JSON
cd ..
node quick-build-locales.mjs
node generate-locales.mjs
```

Validate array lengths: `node generate-missing-arrays.mjs`

## Site identity vs product copy

| Key | Current value | Used for |
| --- | --- | --- |
| `meta.title` | `Crypto Visa — Your Crypto. Your Card.` | Browser tab / favicon title (same in all locales) |
| `brand.name` | `Trust Card` | Header, footer, in-product branding |
| `meta.titleTemplate` | `%s · Trust Card` | Subpage title template in Next.js metadata |

To change **only the tab title**, update `meta.title` in `en.mjs` and patch `meta.title` in every `locales/*.json` (or re-run the sync workflow).

## Production note

Locale JSON is bundled at website build time. Redeploy the website after locale changes.
