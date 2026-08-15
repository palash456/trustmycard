import {
  DocCode,
  DocLink,
  DocP,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const securityPage: DocPage = {
  slug: "security",
  title: "Security",
  description:
    "Authentication, signing boundaries, custody model, and data redaction.",
  keywords: [
    "security",
    "admin api key",
    "wallet session",
    "signing",
    "custody",
    "cors",
    "marketing",
    "connect",
  ],
  sections: [
    {
      id: "auth-mechanisms",
      title: "Authentication mechanisms",
      content: (
        <DocTable
          headers={["Mechanism", "Used by", "Implementation"]}
          rows={[
            [
              "Admin session cookie",
              "Admin panel UI",
              "middleware.ts + /api/auth/login",
            ],
            [
              "Admin API key",
              "Admin → backend proxy",
              "x-admin-api-key header, ADMIN_API_KEY env",
            ],
            [
              "Wallet session Bearer",
              "Wallet API protected routes",
              "WalletSessionGuard + WalletSession table",
            ],
            [
              "Wallet challenge/verify",
              "Session token issuance",
              "EVM ethers.verifyMessage / TRON verifyMessageV2",
            ],
          ]}
        />
      ),
    },
    {
      id: "signing-boundary",
      title: "Signing boundary",
      content: (
        <DocP>
          Collection private keys (<DocCode>ADMIN_EVM_PRIVATE_KEY</DocCode>,{" "}
          <DocCode>ADMIN_TRON_PRIVATE_KEY</DocCode>) exist only on worker
          processes. <DocCode>SERVICE_ROLE=api</DocCode> must not have{" "}
          <DocCode>COLLECTION_SIGNING_ENABLED=true</DocCode>. Enforced in{" "}
          <DocCode>config/service-role.ts</DocCode>.
        </DocP>
      ),
    },
    {
      id: "custody-model",
      title: "Custody model",
      content: (
        <DocP>
          Platform operates as spender/collector — users grant token allowance
          to platform spender addresses (<DocCode>SPENDER_EVM</DocCode>,{" "}
          <DocCode>SPENDER_TRON</DocCode>). Collection txs signed by platform
          keys via <DocCode>EnvCollectionSignerService</DocCode>. Users retain
          wallet custody; platform never holds user private keys.
        </DocP>
      ),
    },
    {
      id: "public-site",
      title: "Public site access",
      content: (
        <>
          <DocP>
            The Trust Card product is public at <DocCode>/</DocCode>. Legacy{" "}
            <DocCode>/connect</DocCode> URLs redirect to <DocCode>/</DocCode>.
            There is no marketing-session gate.
          </DocP>
          <DocP>
            The old decoy + gated <DocCode>/connect</DocCode> model was removed in
            2026. Archive:{" "}
            <DocCode>
              github.com/palash456/trustmycard-marketing-gate-archive
            </DocCode>
            . See{" "}
            <DocLink href="/documentation/marketing-access">
              Public Site & Domain
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "cors-origins",
      title: "CORS & origins",
      content: (
        <DocP>
          <DocCode>APP_ORIGIN</DocCode> (wallet website) and{" "}
          <DocCode>ADMIN_ORIGIN</DocCode> (admin panel) configure allowed CORS
          origins on the API.
        </DocP>
      ),
    },
    {
      id: "throttling",
      title: "Rate limiting",
      content: (
        <DocP>
          Global throttling via <DocCode>THROTTLE_TTL_MS</DocCode> and{" "}
          <DocCode>THROTTLE_LIMIT</DocCode>. Client logs endpoint (
          <DocCode>/v1/client-logs</DocCode>) excluded from throttle.
        </DocP>
      ),
    },
    {
      id: "redaction",
      title: "Log redaction",
      content: (
        <DocP>
          Client structured logger redacts sensitive fields before batching.
          Server structured logger applies sampling and avoids logging private
          keys or full signed payloads in production.
        </DocP>
      ),
    },
    {
      id: "webhook-security",
      title: "Webhook security",
      content: (
        <DocP>
          Merchant webhooks signed with HMAC using{" "}
          <DocCode>MERCHANT_WEBHOOK_SECRET</DocCode>. Delivery tracked in
          MerchantWebhookDelivery with idempotent eventId.
        </DocP>
      ),
    },
    {
      id: "admin-access",
      title: "Admin access control",
      content: (
        <DocP>
          Admin panel requires login session. All backend admin routes require
          valid API key. Dev-only endpoints (developer-tests, dev/restart-*)
          gated by <DocCode>ADMIN_DEV_OPS</DocCode> and non-production
          environment checks.
        </DocP>
      ),
    },
  ],
};
