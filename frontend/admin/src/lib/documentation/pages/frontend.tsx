import {
  DocCode,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const frontendPage: DocPage = {
  slug: "frontend",
  title: "Frontend Structure",
  description:
    "Monorepo frontend packages, shared code, and admin app architecture.",
  keywords: ["frontend", "nextjs", "wallet-sdk", "shared", "website", "admin", "marketing", "connect", "middleware"],
  sections: [
    {
      id: "packages",
      title: "Packages",
      content: (
        <DocTable
          headers={["Package", "Port (dev)", "Role"]}
          rows={[
            [
              "frontend/website",
              "3000",
              "Wallet app + BFF (/connect product route)",
            ],
            ["frontend/marketing", "3001", "Static marketing site preview"],
            ["frontend/admin", "3002", "Operations console (this app)"],
            ["frontend/wallet-sdk", "—", "WalletConnect + approvals library"],
            [
              "frontend/shared",
              "—",
              "Types, constants, IDs, observability schemas",
            ],
          ]}
        />
      ),
    },
    {
      id: "admin-structure",
      title: "Admin app structure",
      content: (
        <DocPre>{`frontend/admin/src/
├── app/
│   ├── (protected)/     # Authenticated routes
│   ├── api/             # Auth + admin BFF proxy
│   └── login/
├── components/          # UI + domain components
│   ├── ui/              # shadcn primitives
│   └── documentation/   # Documentation UI
├── lib/                 # Data fetching, formatting, docs
├── types/               # Page-specific TypeScript types
└── demo/                # Demo mode fixtures`}</DocPre>
      ),
    },
    {
      id: "website-structure",
      title: "Website app structure",
      content: (
        <DocP>
          <DocCode>frontend/website</DocCode> hosts the decoy Travixa cover at{" "}
          <DocCode>/</DocCode> and product connect flow at{" "}
          <DocCode>/connect</DocCode>. API routes under{" "}
          <DocCode>app/api/</DocCode> proxy to Nest backend using wallet-sdk
          server utilities. Production host:{" "}
          <DocCode>mytrustvisa.cards</DocCode> (Render).
        </DocP>
      ),
    },
    {
      id: "marketing-middleware",
      title: "Marketing access middleware",
      content: (
        <>
          <DocP>
            <DocCode>frontend/website/middleware.ts</DocCode> gates all{" "}
            <DocCode>/connect/*</DocCode> routes behind a signed 24h session
            cookie (<DocCode>tv_ms</DocCode>). Ad click IDs on{" "}
            <DocCode>/</DocCode> trigger server verification via{" "}
            <DocCode>/api/marketing/verify</DocCode> → one-time token →{" "}
            <DocCode>/api/marketing/exchange</DocCode>. UTMs alone never grant
            access.
          </DocP>
          <DocPre>{`src/lib/marketing/
├── session.ts                 # 24h tv_ms cookie
├── authorization-token.ts     # 90s one-time exchange token
├── homepage-attestation.ts    # Meta fbclid homepage gate (tv_mh)
├── adapters/                  # google, meta, tiktok, linkedin
└── ...

src/app/api/marketing/verify/   # Server verification
src/app/api/marketing/exchange/ # Token → session
src/app/api/marketing-test/     # Developer test bypass`}</DocPre>
          <DocP>
            Meta Pixel (<DocCode>ConnectMetaPixel.tsx</DocCode>) loads on{" "}
            <DocCode>/connect</DocCode> only. See{" "}
            <DocLink href="/documentation/marketing-access">
              Marketing & Domains
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "shared-package",
      title: "Shared package exports",
      content: (
        <DocTable
          headers={["Module", "Contents"]}
          rows={[
            ["shared/ids/", "flow-id, public-id, IST formatting"],
            [
              "shared/constants/",
              "transaction-lifecycle, settlement, token-collection-state, collection",
            ],
            ["shared/observability/", "LogEvent schemas and types"],
          ]}
        />
      ),
    },
    {
      id: "design-system",
      title: "Admin design system",
      content: (
        <DocP>
          shadcn/ui (base-nova style) + Tailwind 4. Tokens in{" "}
          <DocCode>globals.css</DocCode>. Fonts: Geist (sans), Space Grotesk
          (brand headings). Key layout: AdminShell sidebar, ListPageLayout,
          PageHeader, ListTableCard. Dark mode default via next-themes.
        </DocP>
      ),
    },
    {
      id: "data-fetching",
      title: "Admin data fetching",
      content: (
        <DocTable
          headers={["File", "Role"]}
          rows={[
            ["lib/admin-data.ts", "SSR fetch with demo/live routing"],
            ["lib/admin-api.ts", "Low-level fetch + query builder"],
            [
              "app/api/admin/[...path]/route.ts",
              "Backend proxy with admin API key",
            ],
          ]}
        />
      ),
    },
  ],
};
