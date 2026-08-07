# Cloudflare edge (optional)

Apply WAF/DDoS to **core** surfaces only (`app.*`, `api.*`, optionally `admin.*`). Marketing on Hostinger can stay on separate DNS or use a different zone for blast-radius isolation.

## 1. Proxy `api.trustmycard.com`

1. Add site in Cloudflare; point `api` A/CNAME to Render.
2. SSL mode: **Full (strict)**.
3. WAF → custom rules:
   - Rate limit `POST /v1/auth/*` and `POST /v1/api/approvals/*`
   - Challenge suspicious bot traffic
4. Ensure origin receives `X-Forwarded-Proto: https` (Render handles this).

Set on Render API:

```env
APP_ORIGIN=https://app.trustmycard.com
ADMIN_ORIGIN=https://admin.trustmycard.com
```

## 2. Proxy `app.trustmycard.com`

Same as API. Register this origin in [WalletConnect Cloud](https://cloud.walletconnect.com) allowed origins.

## 3. Admin SSO with Cloudflare Access

1. Create Access application for `admin.trustmycard.com`.
2. Require identity provider (Google Workspace, Okta, etc.) + WebAuthn where supported.
3. Set on Render admin service:

```env
ADMIN_IDENTITY_HEADER=cf-access-authenticated-user-email
```

The admin BFF forwards identity as `x-admin-actor` to the Nest API for audit logs.

## 4. What not to put behind the same Access policy

- Public wallet connect (`app.*`) — must remain reachable by end users.
- Marketing site — keep independent on Hostinger.

## 5. Metrics and Swagger

- `/v1/admin/metrics` requires `x-admin-api-key` (not public).
- Swagger disabled by default (`SWAGGER_ENABLED=false`).
