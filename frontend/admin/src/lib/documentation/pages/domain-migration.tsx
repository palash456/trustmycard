import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import { DomainMigrationTestSuite } from "@/components/documentation/DomainMigrationTestSuite";
import type { DocPage } from "../types";

export const domainMigrationPage: DocPage = {
  slug: "domain-migration",
  title: "Domain Migration",
  description:
    "Generic production domain migration guide — DNS, Render, env vars, WalletConnect, and automated verification.",
  keywords: [
    "domain",
    "migration",
    "hostinger",
    "render",
    "dns",
    "cname",
    "ssl",
    "walletconnect",
    "test",
    "verification",
    "qa",
    "old domain",
    "new domain",
  ],
  sections: [
    {
      id: "overview",
      title: "What you are changing",
      content: (
        <>
          <DocP>
            Move production from your <strong>old domain</strong> (e.g.{" "}
            <DocCode>old-domain.example</DocCode>) to your <strong>new domain</strong>{" "}
            (e.g. <DocCode>new-domain.example</DocCode>). The wallet app stays on
            Render; Hostinger (or your DNS provider) is used for DNS only — not
            apex website hosting.
          </DocP>
          <DocTable
            headers={["Old", "New"]}
            rows={[
              ["https://old-domain.example", "https://new-domain.example"],
              [
                "https://api.old-domain.example",
                "https://api.new-domain.example",
              ],
              [
                "https://www.old-domain.example",
                "https://www.new-domain.example",
              ],
              [
                "https://admin.old-domain.example",
                "https://admin.new-domain.example",
              ],
            ]}
          />
          <DocP>
            Unchanged: product at <DocCode>/</DocCode>, legal pages at root
            paths, legacy <DocCode>/connect</DocCode> redirects to{" "}
            <DocCode>/</DocCode>. See{" "}
            <DocLink href="/documentation/marketing-access">
              Public Site & Domain
            </DocLink>{" "}
            for URL map and Meta ads.
          </DocP>
          <DocCallout variant="tip">
            Current production: <DocCode>mytrustvisa.cards</DocCode> on micro
            VPS + Caddy. Full guide:{" "}
            <DocLink href="/documentation/marketing-access">
              Public Site & Domain
            </DocLink>{" "}
            and <DocCode>docs/infrastructure/mytrustvisa-domain-security.md</DocCode>.
            Deploy: <DocCode>deploy/README.md</DocCode>. Estimated time: 30–60
            min (+ DNS propagation up to 24–48h).
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
            "New domain (e.g. new-domain.example) is in your DNS registrar account.",
            "Access to DNS settings and Render dashboard.",
            "Access to WalletConnect Cloud project settings.",
            "Ads/marketing person ready to update destination URL after go-live.",
            "Do NOT connect the new domain apex to shared hosting website builder.",
          ]}
        />
      ),
    },
    {
      id: "render-domains",
      title: "Step 1 — Render custom domains",
      content: (
        <>
          <DocP>
            <strong>tmc-wallet-app</strong> → Settings → Custom Domains → Add:
          </DocP>
          <DocPre>{`new-domain.example
www.new-domain.example   # optional but recommended`}</DocPre>
          <DocP>
            <strong>tmc-backend</strong> → Settings → Custom Domains → Add:
          </DocP>
          <DocPre>{`api.new-domain.example`}</DocPre>
          <DocP>
            Keep Render&apos;s DNS instructions open — you need the CNAME targets
            for your DNS provider.
          </DocP>
        </>
      ),
    },
    {
      id: "hostinger-dns",
      title: "Step 2 — DNS (Hostinger or your provider)",
      content: (
        <>
          <DocP>
            DNS panel → <DocCode>new-domain.example</DocCode> → DNS Zone.
          </DocP>
          <DocTable
            headers={["Type", "Name", "Value", "Notes"]}
            rows={[
              [
                "CNAME or ALIAS",
                "@",
                "Render tmc-wallet-app hostname",
                "Apex → wallet app",
              ],
              [
                "CNAME",
                "www",
                "new-domain.example or Render www target",
                "www → apex",
              ],
              [
                "CNAME",
                "api",
                "Render tmc-backend hostname",
                "API subdomain",
              ],
            ]}
          />
          <DocCallout variant="warning">
            Remove any apex <DocCode>@</DocCode> records pointing to shared
            hosting IP. Do not upload a static marketing zip to apex{" "}
            <DocCode>public_html</DocCode> if the wallet app serves the apex.
          </DocCallout>
          <DocP>
            Wait for Render SSL to turn green (often 15 min–2 hours after DNS
            propagates).
          </DocP>
        </>
      ),
    },
    {
      id: "render-env",
      title: "Step 3 — Render environment variables",
      content: (
        <>
          <DocP>
            <strong>tmc-wallet-app</strong> — update then Save, rebuild, and
            deploy:
          </DocP>
          <DocTable
            headers={["Variable", "New value"]}
            rows={[
              ["NEXT_PUBLIC_APP_URL", "https://new-domain.example"],
              ["NEXT_PUBLIC_MARKETING_URL", "https://www.new-domain.example"],
              ["BACKEND_API_URL", "https://api.new-domain.example"],
            ]}
          />
          <DocP>
            Keep unchanged: <DocCode>NEXT_PUBLIC_PROJECT_ID</DocCode>. Removed
            legacy vars: <DocCode>MARKETING_SESSION_*</DocCode>,{" "}
            <DocCode>MARKETING_TEST_SECRET</DocCode>, <DocCode>GOOGLE_ADS_*</DocCode>.
          </DocP>
          <DocP>
            <strong>tmc-backend</strong> — update then redeploy:
          </DocP>
          <DocTable
            headers={["Variable", "New value"]}
            rows={[
              ["APP_ORIGIN", "https://new-domain.example"],
              [
                "ADMIN_ORIGIN",
                "https://admin.new-domain.example (or localhost)",
              ],
            ]}
          />
          <DocCallout variant="warning">
            <DocCode>NEXT_PUBLIC_*</DocCode> are baked at build time — wallet
            app must be rebuilt after changing them.
          </DocCallout>
        </>
      ),
    },
    {
      id: "walletconnect",
      title: "Step 4 — WalletConnect Cloud",
      content: (
        <DocP>
          WalletConnect Cloud → your project → Allowed origins → add{" "}
          <DocCode>https://new-domain.example</DocCode>. Remove the old{" "}
          <DocCode>old-domain.example</DocCode> origin after verification.
          Wallet connect fails on the new domain until this is done.
        </DocP>
      ),
    },
    {
      id: "meta-ads",
      title: "Step 5 — Ads / marketing destination URL",
      content: (
        <DocTable
          headers={["", "URL"]}
          rows={[
            ["Old ad destination", "https://old-domain.example/"],
            ["New ad destination", "https://new-domain.example/"],
          ]}
        />
      ),
    },
    {
      id: "local-env",
      title: "Step 6 — Local env files (optional)",
      content: (
        <DocPre>{`# env/profiles/production/website.env
NEXT_PUBLIC_APP_URL=https://new-domain.example
NEXT_PUBLIC_MARKETING_URL=https://www.new-domain.example
BACKEND_API_URL=https://api.new-domain.example

# env/profiles/production/backend.env
APP_ORIGIN=https://new-domain.example`}</DocPre>
      ),
    },
    {
      id: "verification",
      title: "Step 7 — Verify",
      content: (
        <>
          <DocPre>{`curl -sI https://new-domain.example/ | head -3
curl -sI http://new-domain.example/ | head -3
curl -sI https://new-domain.example/connect | head -3
curl -s https://api.new-domain.example/v1/api/settings/public | head`}</DocPre>
          <DocTable
            headers={["Test (incognito)", "Expected"]}
            rows={[
              ["https://new-domain.example/", "Product homepage"],
              [
                "https://new-domain.example/connect",
                "Redirect to / (legacy path)",
              ],
              [
                "https://new-domain.example/frequentlyaskedquestions",
                "FAQ loads (public)",
              ],
              [
                "/?fbclid=IwAR0123456789abcdefghijklmnopqrstuvwxyz",
                "Stays on / (public product)",
              ],
              ["WalletConnect on /", "Modal works, no origin error"],
              ["http://new-domain.example/", "Redirects to HTTPS"],
            ]}
          />
          <DocCallout variant="tip">
            For the full automated checklist, use{" "}
            <strong>Run migration test suite</strong> in Step 9 — enter your old
            and new domains in the popup.
          </DocCallout>
        </>
      ),
    },
    {
      id: "old-domain",
      title: "Step 8 — Old domain (old-domain.example)",
      content: (
        <DocTable
          headers={["Option", "Action"]}
          rows={[
            [
              "A — Redirect (recommended)",
              "Point old-domain.example DNS to a redirect service or Render redirect to new-domain.example",
            ],
            [
              "B — Let expire",
              "Update all ads/links; old domain stops when registration lapses",
            ],
            [
              "C — Run both temporarily",
              "Add old domain as second Render custom domain; CORS needs both origins (not default)",
            ],
          ]}
        />
      ),
    },
    {
      id: "order-of-operations",
      title: "Recommended order",
      content: (
        <DocFlow
          steps={[
            "Add new-domain.example + api.new-domain.example on Render.",
            "Set DNS for new-domain.example.",
            "Wait for Render SSL ✓.",
            "Update Render env vars → redeploy wallet + backend.",
            "Update WalletConnect allowed origin.",
            "Run migration test suite in Step 9 — enter old + new domains, run automated tests.",
            "Update ad destination URL to https://new-domain.example/.",
            "(Optional) Redirect or retire old-domain.example.",
          ]}
        />
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
              "Registrar parking / wrong page",
              "Apex @ still points to shared hosting — point to Render",
            ],
            [
              "SSL pending on Render",
              "Wait for DNS; confirm CNAME matches Render exactly",
            ],
            [
              "WalletConnect origin error",
              "Add https://new-domain.example in WalletConnect Cloud",
            ],
            [
              "API CORS errors",
              "APP_ORIGIN=https://new-domain.example on tmc-backend, redeploy",
            ],
            [
              "/connect broken after migration",
              "Redeploy wallet app after NEXT_PUBLIC_APP_URL change",
            ],
            [
              "Ads still use old URL",
              "Update destination to https://new-domain.example/",
            ],
          ]}
        />
      ),
    },
    {
      id: "migration-test-suite",
      title: "Step 9 — Full migration test suite (required)",
      content: (
        <>
          <DocP>
            After Steps 1–8 are complete, open the test suite below. Enter your{" "}
            <strong>old domain</strong> and <strong>new domain</strong> (hostname
            only, e.g. <DocCode>old-domain.example</DocCode> and{" "}
            <DocCode>new-domain.example</DocCode>), then click{" "}
            <strong>Run automated tests</strong>. Results appear in the panel.
            Only B8 (WalletConnect UI) and B11 (TLS dashboard) need a quick
            manual confirm.
          </DocP>
          <DomainMigrationTestSuite />
          <DocCallout variant="tip" title="When migration is 100% complete">
            All automated checks pass in the modal, ad destination is updated to{" "}
            <DocCode>https://new-domain.example/</DocCode>, and the old domain is
            retired or redirected per Step 8.
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
            "☐ Render: new-domain.example on tmc-wallet-app",
            "☐ Render: api.new-domain.example on tmc-backend",
            "☐ DNS: apex + api → Render (not shared hosting website)",
            "☐ Render env: NEXT_PUBLIC_APP_URL, BACKEND_API_URL, APP_ORIGIN updated",
            "☐ Wallet app redeployed",
            "☐ Backend redeployed",
            "☐ WalletConnect origin updated",
            "☐ Step 9 — migration test suite: all automated checks pass",
            "☐ Ad destination URL updated to https://new-domain.example/",
          ]}
        />
      ),
    },
  ],
};
