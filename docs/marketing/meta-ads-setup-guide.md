# Meta / Instagram Ads — Setup Guide for Media Buyers

This guide is for the person running Meta (Facebook / Instagram) ads for **mytrustvisa.cards**.

For the complete domain, security, and access reference, see [mytrustvisa-domain-security.md](../infrastructure/mytrustvisa-domain-security.md).

It explains which URL to use, what visitors see, how tracking works, and what **not** to change.

For technical / developer details, see [marketing-access.md](../infrastructure/marketing-access.md).

---

## Quick answer

| Question | Answer |
|----------|--------|
| **What URL should ads point to?** | `https://mytrustvisa.cards/` |
| **Will ad users see the Trust Card site?** | Yes — they are redirected to `https://mytrustvisa.cards/connect` automatically |
| **Should ads point to `/connect`?** | **No** — never use `/connect` as the ad destination |
| **Do UTMs open the product site?** | **No** — UTMs are for reporting only |
| **What actually unlocks `/connect`?** | Meta’s `fbclid` on the homepage (added automatically on ad clicks) |
| **Where is the Meta Pixel installed?** | Already on `/connect` in code — do not paste it elsewhere |

---

## Ad destination URL

### Use this

```text
https://mytrustvisa.cards/
```

### Optional — UTMs for your reports (recommended)

```text
https://mytrustvisa.cards/?utm_source=instagram&utm_medium=paid&utm_campaign=YOUR_CAMPAIGN_NAME
```

Meta will still append `fbclid` on top of this when someone clicks.

### Never use this

```text
https://mytrustvisa.cards/connect
https://mytrustvisa.cards/connect?utm_source=instagram
```

Manual `/connect` visits are blocked. Ad clicks to `/connect` will **not** open the product site.

---

## What happens when someone clicks your ad

```text
User clicks Meta/Instagram ad
        ↓
https://mytrustvisa.cards/?fbclid=...&utm_...
        ↓
Server checks fbclid (homepage only)
        ↓
https://mytrustvisa.cards/connect
        ↓
Trust Card product site + Meta Pixel fires
```

Notes:

- The user may only see the homepage (`/`) for a **split second** before redirect.
- That homepage is a **cover site** (Travixa) — this is intentional.
- After redirect, they land on the **real product** at `/connect`.
- Access lasts **`MARKETING_SESSION_TTL_MINUTES`** (production: **1440** = 24 hours) in the same browser.

---

## Meta Pixel

### Already installed — do not paste the script again

The Meta Pixel is built into the website and loads **only** on `/connect` pages:

- `/connect`
- `/connect/privacypolicy`
- `/connect/termsandconditions`
- `/connect/frequentlyaskedquestions`

It does **not** load on the public homepage (`/`) for normal visitors.

**Pixel ID in use:** `1682517452850789`

### In Meta Events Manager

1. Use the same Pixel ID above.
2. Verify events under **Test Events** after a test ad click (see checklist below).
3. You should see **PageView** on `/connect` after a real ad click flow.

### Do not

- Paste the pixel snippet into Hostinger or any static hosting.
- Add a second copy of the pixel in Meta’s “manual install” on the homepage.
- Change the ad URL to `/connect` just to make the pixel fire — it will break access.

---

## UTM parameters

| Parameter | Purpose | Grants `/connect` access? |
|-----------|---------|---------------------------|
| `utm_source` | Reporting (e.g. `instagram`, `facebook`) | **No** |
| `utm_medium` | Reporting (e.g. `paid`) | **No** |
| `utm_campaign` | Reporting (campaign name) | **No** |
| `fbclid` | Meta click ID (auto-added by Meta) | **Yes** (when on homepage) |

**Rule:** UTMs are for **analytics and campaign naming only**. They never replace `fbclid`.

---

## Campaign setup checklist (Meta Ads Manager)

### 1. Ad set / ad level — Website URL

- [ ] Destination: `https://mytrustvisa.cards/`
- [ ] **Not** `/connect`

### 2. Tracking

- [ ] Meta Pixel `1682517452850789` selected on the ad account
- [ ] Website events enabled for the campaign

### 3. URL parameters (optional)

Add UTMs in Ads Manager URL parameters or in the destination URL:

```text
utm_source=instagram&utm_medium=paid&utm_campaign={{campaign.name}}
```

### 4. Before going live — test click

1. Open an **incognito / private** browser window.
2. Click a test ad (or use Meta’s preview link).
3. Confirm you end up on `https://mytrustvisa.cards/connect`.
4. In Events Manager → **Test Events**, confirm **PageView** appears.

### 5. After launch — spot checks

| Check | Expected |
|-------|----------|
| Ad click lands on `/connect` | Trust Card blue site, wallet connect UI |
| Events Manager shows PageView | On `/connect` URL |
| Typing `/connect` manually (no ad) | Redirected to homepage cover site |
| `/?utm_source=instagram` without ad click | Stays on cover site |

---

## What normal (non-ad) visitors see

| How they arrive | What they see |
|-----------------|---------------|
| Types `trustvisa.cards` in browser | Cover site (Travixa) |
| Types `trustvisa.cards/connect` | Cover site — **no product access** |
| Bookmarks `/connect` | Cover site |
| Adds `?utm_source=instagram` manually | Cover site — UTMs alone do nothing |

Only ad clicks with `fbclid` on the homepage (or returning visitors with an active 24h session) reach `/connect`.

---

## Common mistakes

| Mistake | What happens |
|---------|----------------|
| Ad URL set to `/connect` | User sees cover site — ad traffic lost |
| Relying on UTMs only (no real ad click / no `fbclid`) | User stays on cover site |
| Pasting pixel on homepage `/` | Unnecessary; may expose tracking on cover site |
| Removing `fbclid` with a redirect tool before our server sees it | User stays on cover site |
| Link shortener strips query parameters | `fbclid` lost — user stays on cover site |

**Important:** Any link shortener or redirect must **preserve** `fbclid` in the URL.

---

## Instagram vs Facebook

Both use the same setup:

- Same destination: `https://mytrustvisa.cards/`
- Same `fbclid` behavior on click
- Same redirect to `/connect`
- Use `utm_source=instagram` or `utm_source=facebook` only for your reports

---

## Troubleshooting

### Ad click does not reach `/connect`

1. Confirm ad URL is exactly `https://mytrustvisa.cards/` (not `/connect`).
2. Check the landing URL in the browser address bar — is `fbclid=...` present?
3. If `fbclid` is missing, check Meta auto-tagging / URL settings.
4. If using a shortener, confirm it keeps query parameters.
5. Ask dev team to confirm latest site is deployed on Render.

### Pixel shows no events

1. Confirm you completed a full ad click flow and reached `/connect`.
2. Pixel only fires on `/connect` — not on the cover homepage.
3. Use Events Manager → **Test Events** with a live test click.
4. Disable ad blockers when testing.

### Campaign reports clicks but site team sees no product visits

- Clicks in Meta ≠ confirmed `/connect` sessions.
- If `fbclid` is stripped or URL points to `/connect`, users never reach the product.

---

## Summary for handoff

**Give Meta Ads this:**

```text
Website URL:  https://mytrustvisa.cards/
Pixel ID:     1682517452850789
Product URL:  https://mytrustvisa.cards/connect  (automatic — do NOT use as ad destination)
```

**One-line rule:**

> Point ads at the **homepage**; the server sends real ad visitors to **`/connect`** using `fbclid`.

---

## Contact

Technical issues (redirects, access, pixel code): development team.

Campaign URL / UTM / tracking questions: use this guide first, then escalate with the exact ad URL and a screenshot of the browser address bar after clicking the ad.
