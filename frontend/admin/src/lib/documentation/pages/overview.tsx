import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const overviewPage: DocPage = {
  slug: "overview",
  title: "System Overview",
  description:
    "What Trust My Card is, how the monorepo is organized, and how the major surfaces fit together.",
  keywords: [
    "trust my card",
    "monorepo",
    "wallet",
    "admin",
    "backend",
    "product",
    "architecture",
  ],
  sections: [
    {
      id: "what-is-tmc",
      title: "What is Trust My Card?",
      content: (
        <>
          <DocP>
            Trust My Card (TMC) is a wallet-linking platform. End users scan a
            QR code or open a connect link, approve token allowances (USDT,
            USDC) and native assets on EVM or TRON networks, and the platform
            collects approved tokens to a platform spender/collector wallet in
            the background.
          </DocP>
          <DocP>
            The product is split across a decoy marketing surface, a wallet
            connect app, a NestJS API + worker backend, and an admin operations
            console. All share types and constants via{" "}
            <DocCode>@trustmycard/shared</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "surfaces",
      title: "Production surfaces",
      content: (
        <DocTable
          headers={["Surface", "Package", "Host", "Role"]}
          rows={[
            [
              "Marketing",
              <DocCode key="m">frontend/marketing</DocCode>,
              "trustmycard.com (Hostinger)",
              "Static marketing site",
            ],
            [
              "Wallet app",
              <DocCode key="w">frontend/website</DocCode>,
              "mytrustvisa.cards (Render)",
              "Decoy at /, gated product at /connect",
            ],
            [
              "API",
              <DocCode key="b">backend</DocCode>,
              "api.mytrustvisa.cards",
              "NestJS API (budget: SERVICE_ROLE=all)",
            ],
            [
              "Workers",
              <DocCode key="wk">backend</DocCode>,
              "No public HTTP",
              "BullMQ consumers + schedulers (SERVICE_ROLE=worker)",
            ],
            [
              "Admin",
              <DocCode key="a">frontend/admin</DocCode>,
              "admin.trustmycard.com",
              "Operations console (this app)",
            ],
          ]}
        />
      ),
    },
    {
      id: "core-flow",
      title: "Core user journey",
      content: (
        <>
          <DocFlow
            steps={[
              "User arrives via Meta ad at / (fbclid) or developer test URL — redirected to /connect.",
              "User selects a card tier on /connect.",
              "WalletConnect session opens; user connects EVM and/or TRON wallet.",
              "Client mints a semantic journey ID (flow-*) after wallet address is known.",
              "User selects a network; wallet phase runs USDT → USDC approvals (and Tron native sign).",
              "Background settlement confirms approvals, queues token collection, waits for collection idle, then executes native transfer.",
              "Admin can trace the full journey via Transactions using the flow-* ID.",
            ]}
          />
          <DocCallout variant="tip">
            <DocCode>/connect</DocCode> is gated — see{" "}
            <DocLink href="/documentation/marketing-access">
              Domain Security & Access
            </DocLink>
            . Meta ads must point to <DocCode>https://mytrustvisa.cards/</DocCode>
            , not <DocCode>/connect</DocCode>.
          </DocCallout>
          <DocCallout variant="tip">
            See{" "}
            <DocLink href="/documentation/system-design">
              System Design & Tech Stack
            </DocLink>{" "}
            for the full technical architecture, flowcharts, and package map.
            Also see{" "}
            <DocLink href="/documentation/transaction-lifecycle">
              Transaction lifecycle
            </DocLink>{" "}
            and{" "}
            <DocLink href="/documentation/wallet-flows">
              Wallet & connect flows
            </DocLink>{" "}
            for step-by-step implementation detail.
          </DocCallout>
        </>
      ),
    },
    {
      id: "repo-layout",
      title: "Repository layout",
      content: (
        <DocPre>{`trustmycard/
├── backend/              # NestJS API + workers
├── frontend/
│   ├── marketing/        # Static marketing → Hostinger
│   ├── website/          # Wallet app + BFF → Render
│   ├── admin/            # Ops console → Render (this app)
│   ├── wallet-sdk/       # WalletConnect + approvals + settlement
│   └── shared/           # Types, constants, IDs, observability schemas
├── config/               # load-env.mjs + legacy platform.env
├── env/profiles/         # TMC_ENV profiles (development, production-preview, production)
├── docs/                 # Markdown docs (source material; mirrored here)
└── render.yaml           # Render blueprint`}</DocPre>
      ),
    },
    {
      id: "local-dev",
      title: "Local development",
      content: (
        <>
          <DocP>From the repository root, typical local ports:</DocP>
          <DocTable
            headers={["Command", "Port", "Surface"]}
            rows={[
              ["cd frontend && npm run dev:website", "3000", "Wallet app"],
              [
                "cd frontend && npm run dev:marketing",
                "3001",
                "Marketing preview",
              ],
              ["cd frontend && npm run dev:admin", "3002", "Admin panel"],
              ["cd backend && npm run start:dev", "4000", "NestJS API"],
            ]}
          />
          <DocP>
            Backend requires PostgreSQL (<DocCode>DATABASE_URL</DocCode>) and
            Redis (<DocCode>REDIS_URL</DocCode>) for queue mode. Copy{" "}
            <DocCode>env/profiles/development/platform.env.example</DocCode> to{" "}
            <DocCode>env/profiles/development/platform.env</DocCode> and run{" "}
            <DocCode>npx prisma db push</DocCode>.
          </DocP>
        </>
      ),
      subsections: [
        {
          id: "service-role-local",
          title: "Local all-in-one backend",
          content: (
            <DocP>
              For local development, <DocCode>SERVICE_ROLE=all</DocCode> runs
              API and workers in one process. Production splits{" "}
              <DocCode>SERVICE_ROLE=api</DocCode> (no signing keys) from{" "}
              <DocCode>SERVICE_ROLE=worker</DocCode> (collection signing
              enabled).
            </DocP>
          ),
        },
      ],
    },
    {
      id: "key-terminology",
      title: "Key terminology",
      content: (
        <DocTable
          headers={["Term", "Meaning"]}
          rows={[
            [
              "Journey / flow ID",
              "flow-* business ID for one user attempt (scan → settlement)",
            ],
            [
              "traceId / transactionId",
              "Same journey ID stored on server rows and in logs",
            ],
            [
              "publicId",
              "Human-readable child ID (approval-usdt-*, transfer-*, etc.)",
            ],
            [
              "Wallet phase",
              "User-visible wallet popups (approvals, Tron native sign)",
            ],
            [
              "Settlement phase",
              "Background: confirm, collect tokens, execute native",
            ],
            ["Owner", "End-user wallet address"],
            [
              "Spender / collector",
              "Platform wallet receiving allowance and signing transferFrom",
            ],
            [
              "CollectionIntent",
              "Merchant collection lifecycle record tied to an Approval",
            ],
            ["BFF", "Next.js /api/* routes proxying to Nest backend"],
          ]}
        />
      ),
    },
  ],
};
