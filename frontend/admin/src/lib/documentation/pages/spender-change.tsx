import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import { SpenderChangeTestSuite } from "@/components/documentation/SpenderChangeTestSuite";
import type { DocPage } from "../types";

export const spenderChangePage: DocPage = {
  slug: "spender-change",
  title: "Spender / Collector Rotation",
  description:
    "Guide for rotating platform spender wallets — env vars, private keys, Render deploy, and automated verification.",
  keywords: [
    "spender",
    "collector",
    "wallet",
    "rotation",
    "SPENDER_EVM",
    "SPENDER_TRON",
    "ADMIN_EVM_PRIVATE_KEY",
    "ADMIN_TRON_PRIVATE_KEY",
    "platform.env",
    "verification",
    "test",
  ],
  sections: [
    {
      id: "overview",
      title: "What you are changing",
      content: (
        <>
          <DocP>
            The <strong>spender / collector</strong> is the platform wallet that
            receives ERC-20 / TRC-20 allowances and signs{" "}
            <DocCode>transferFrom</DocCode> during collection. Native coin
            transfers (ETH, TRX, BNB, …) also go to the same addresses.
          </DocP>
          <DocTable
            headers={["Role", "Env vars", "Loaded by"]}
            rows={[
              [
                "Spender address (public)",
                "SPENDER_EVM, SPENDER_TRON",
                "Backend + website (via public settings)",
              ],
              [
                "Collection signing key (secret)",
                "ADMIN_EVM_PRIVATE_KEY, ADMIN_TRON_PRIVATE_KEY",
                "Backend worker only",
              ],
              [
                "Legacy alias (avoid if possible)",
                "NEXT_PUBLIC_SPENDER_EVM, NEXT_PUBLIC_SPENDER_TRON",
                "Fallback if SPENDER_* unset — must match",
              ],
            ]}
          />
          <DocCallout variant="warning">
            Private keys never enter the website or admin UI. Only spender{" "}
            <em>addresses</em> are exposed via{" "}
            <DocCode>GET /v1/api/settings/public</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "prerequisites",
      title: "Before you start",
      content: (
        <DocFlow
          steps={[
            "Generate or import new EVM and/or TRON collector wallet(s).",
            "Note the new 0x… and T… addresses.",
            "Fund new wallets with gas (EVM native + TRX).",
            "Keep old private keys if you need to collect legacy on-chain allowances.",
            "Plan a backend + website restart (local) or Render redeploy (production).",
          ]}
        />
      ),
    },
    {
      id: "config-file",
      title: "Step 1 — Update platform.env",
      content: (
        <>
          <DocP>
            Edit <DocCode>env/profiles/$TMC_ENV/platform.env</DocCode> for each
            environment you rotate:
          </DocP>
          <DocPre>{`# EVM collector
SPENDER_EVM=0xNewSpenderAddress...
ADMIN_EVM_PRIVATE_KEY=0x...   # must derive to SPENDER_EVM

# TRON collector
SPENDER_TRON=TNewSpenderAddress...
ADMIN_TRON_PRIVATE_KEY=...    # must derive to SPENDER_TRON

# Production preview / live
ALLOW_SELF_SPENDER=false`}</DocPre>
          <DocTable
            headers={["Profile", "Path"]}
            rows={[
              ["development", "env/profiles/development/platform.env"],
              [
                "production-preview",
                "env/profiles/production-preview/platform.env",
              ],
              ["production", "env/profiles/production/platform.env"],
            ]}
          />
          <DocCallout variant="tip">
            Full runbook:{" "}
            <DocCode>docs/operations/change-spender-collector-guide.md</DocCode>
          </DocCallout>
        </>
      ),
    },
    {
      id: "production-split",
      title: "Step 2 — Production service split (Render)",
      content: (
        <>
          <DocP>On Render, collection keys are split across services:</DocP>
          <DocTable
            headers={["Service", "Vars", "Purpose"]}
            rows={[
              [
                "tmc-api",
                "SPENDER_EVM, SPENDER_TRON",
                "Public addresses for API + connect flow",
              ],
              [
                "tmc-workers",
                "ADMIN_EVM_PRIVATE_KEY, ADMIN_TRON_PRIVATE_KEY",
                "Signs transferFrom — must match SPENDER_*",
              ],
            ]}
          />
          <DocP>
            API service must <strong>not</strong> have collection private keys.{" "}
            <DocCode>COLLECTION_SIGNING_ENABLED=false</DocCode> on API;{" "}
            <DocCode>true</DocCode> on workers. See{" "}
            <DocLink href="/documentation/configuration">Configuration</DocLink>{" "}
            and <DocCode>docs/infrastructure/secrets.md</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "restart",
      title: "Step 3 — Restart / redeploy",
      content: (
        <DocFlow
          steps={[
            "Local: restart backend (API + workers) and website after platform.env change.",
            "Render: redeploy tmc-api and tmc-workers after updating env groups.",
            "Confirm Admin → System shows secrets.evm.spenderMatch and secrets.tron.spenderMatch as true.",
            "Confirm GET /v1/api/settings/public returns new spenderEvm and spenderTron.",
          ]}
        />
      ),
    },
    {
      id: "historical-data",
      title: "Historical data & legacy allowances",
      content: (
        <>
          <DocP>
            <DocCode>Approval.spenderAddress</DocCode> is set from env at confirm
            time. On-chain allowance stays with the <strong>old</strong> spender
            until users re-approve.
          </DocP>
          <DocP>
            <DocCode>collectionToAddress</DocCode> per approval (Admin →
            Approvals) overrides payout destination only — not the on-chain
            allowance spender.
          </DocP>
          <DocCallout variant="warning">
            Do not delete old private keys until all legacy allowances are
            collected or abandoned.
          </DocCallout>
        </>
      ),
    },
    {
      id: "dev-self-spender",
      title: "Dev-only: ALLOW_SELF_SPENDER",
      content: (
        <>
          <DocP>
            In development, <DocCode>ALLOW_SELF_SPENDER=true</DocCode> lets owner
            and spender be the same wallet. Set{" "}
            <DocCode>DEV_COLLECTION_DEST_EVM</DocCode> /{" "}
            <DocCode>DEV_COLLECTION_DEST_TRON</DocCode> so collected tokens go
            to a visible address. Must match in website env if enabled.
          </DocP>
        </>
      ),
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      content: (
        <DocTable
          headers={["Problem", "Fix"]}
          rows={[
            [
              "spenderMatch: false",
              "ADMIN_*_PRIVATE_KEY does not derive to SPENDER_* — fix platform.env",
            ],
            [
              "Website shows old spender",
              "Restart website after platform.env change; check BFF /api/settings/public",
            ],
            [
              "Public API still has old address",
              "Backend not restarted; or wrong TMC_ENV profile loaded",
            ],
            [
              "Collection fails after rotation",
              "Worker env missing ADMIN_* keys; or new wallet needs gas",
            ],
            [
              "NEXT_PUBLIC_SPENDER_* conflict",
              "Remove legacy vars or ensure they match SPENDER_*",
            ],
            [
              "New approvals still on old spender",
              "Website cache — hard refresh; verify public settings JSON",
            ],
          ]}
        />
      ),
    },
    {
      id: "spender-test-suite",
      title: "Step 4 — Full spender rotation test suite (required)",
      content: (
        <>
          <DocP>
            After Steps 1–3, open the test suite below. Enter your{" "}
            <strong>old</strong> and <strong>new</strong> EVM and TRON spender
            addresses, optional new private keys (to verify key↔address match),
            and backend URLs for dev / production. Click{" "}
            <strong>Run automated tests</strong>. Phase G (env files, Render,
            funding, connect flow) needs a quick manual confirm.
          </DocP>
          <SpenderChangeTestSuite />
          <DocCallout variant="tip" title="When rotation is complete">
            All automated checks pass, Admin → System shows{" "}
            <DocCode>spenderMatch: true</DocCode>, and a new approval on{" "}
            <DocCode>/connect</DocCode> shows the new{" "}
            <DocCode>spenderAddress</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "checklist",
      title: "Checklist summary",
      content: (
        <DocFlow
          steps={[
            "☐ New wallets generated and funded",
            "☐ platform.env updated (SPENDER_* + ADMIN_*_PRIVATE_KEY)",
            "☐ Render: tmc-api has SPENDER_*, tmc-workers have ADMIN_* keys",
            "☐ Backend + website restarted / redeployed",
            "☐ Admin → System spenderMatch: true (EVM + TRON)",
            "☐ Spender test suite — all automated checks pass",
            "☐ One new approval confirms new spenderAddress",
            "☐ Old keys retained for legacy allowances (if needed)",
          ]}
        />
      ),
    },
  ],
};
