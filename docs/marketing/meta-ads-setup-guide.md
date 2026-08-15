# Meta / Instagram Ads — Setup Guide for Media Buyers

This guide is for the person running Meta (Facebook / Instagram) ads for **mytrustvisa.cards**.

For the complete domain, security, and access reference, see [mytrustvisa-domain-security.md](../infrastructure/mytrustvisa-domain-security.md).

---

## Quick answer

| Question | Answer |
|----------|--------|
| **What URL should ads point to?** | `https://mytrustvisa.cards/` |
| **Will ad users see the Trust Card site?** | **Yes** — the product loads directly at `/` |
| **Should ads point to `/connect`?** | **No** — `/connect` is a legacy redirect to `/` |
| **Do UTMs affect access?** | UTMs are for reporting only — the site is always public |
| **Where is the Meta Pixel installed?** | In the wallet app code — do not paste it elsewhere |

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

### Do not use

```text
https://mytrustvisa.cards/connect
```

Legacy `/connect` URLs redirect to `/`. Use the homepage URL in all ads.

---

## What happens when someone clicks your ad

```text
User clicks Meta/Instagram ad
        ↓
https://mytrustvisa.cards/?fbclid=...&utm_...
        ↓
Trust Card product site loads at /
        ↓
Meta Pixel fires PageView
```

Notes:

- There is no cover/decoy page and no redirect to a separate product URL.
- Users land directly on the Trust Card homepage.
- Meta auto-appends `fbclid` on paid ad clicks.

---

## Meta Pixel

### Already installed — do not paste the script again

The Meta Pixel is built into the wallet app and loads on public pages.

**Pixel ID in use:** `2158981564683913`

### In Meta Events Manager

1. Use the same Pixel ID above.
2. Verify events under **Test Events** after a test ad click.
3. You should see **PageView** on `/` after a real ad click.

### Do not

- Paste the pixel snippet into Hostinger or any static hosting.
- Add a second copy of the pixel in Meta's "manual install".
- Change the ad destination to `/connect`.

---

## Pre-launch checklist

- [ ] Ad destination is `https://mytrustvisa.cards/` (with optional UTMs)
- [ ] Test ad preview opens the Trust Card product (not an error page)
- [ ] Meta Pixel ID `2158981564683913` is selected in Events Manager
- [ ] Test Events shows PageView after clicking a test ad
- [ ] WalletConnect "Connect Wallet" works on the homepage (developer check)

---

## Historical reference

The old flow (decoy homepage → marketing session → gated `/connect`) was removed in 2026. See the private archive for the previous implementation: [trustmycard-marketing-gate-archive](https://github.com/palash456/trustmycard-marketing-gate-archive).
