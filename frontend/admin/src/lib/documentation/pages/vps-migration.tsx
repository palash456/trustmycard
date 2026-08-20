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

export const vpsMigrationPage: DocPage = {
  slug: "vps-migration",
  title: "VPS Migration",
  description:
    "Move production between VPS providers or droplets, replace a server, or migrate to Render — configuration architecture, DNS, deploy steps, and rollback.",
  keywords: [
    "vps",
    "migration",
    "hosting",
    "digitalocean",
    "hetzner",
    "hostinger",
    "droplet",
    "server",
    "render",
    "docker-vps",
    "VPS_HOST",
    "provider.credentials",
    "platform.env",
    "caddy",
    "dns",
    "neon",
    "upstash",
    "rollback",
    "deploy.sh",
    "flokinet",
    "confirm-external-data",
  ],
  sections: [
    {
      id: "configuration-architecture",
      title: "Configuration architecture",
      content: (
        <>
          <DocP>
            Hosting moves use <strong>two separate config layers</strong>. Do
            not merge deploy SSH credentials into runtime application config.
          </DocP>
          <DocTable
            headers={["Layer", "Files", "Purpose"]}
            rows={[
              [
                "Runtime (product)",
                "config/platform.env, env/profiles/production/*, deploy/runtime-config/production.json",
                "WEBSITE_DOMAIN, wallets, DATABASE_URL, REDIS_URL, compiled public URLs",
              ],
              [
                "Deploy (operator)",
                "deploy/provider.credentials.env",
                "SSH access for ./deploy.sh only — never loaded by running apps",
              ],
            ]}
          />
          <DocTable
            headers={["Variable", "File", "When it changes"]}
            rows={[
              [
                "VPS_HOST",
                "deploy/provider.credentials.env",
                "Every VPS swap — new server IP or hostname",
              ],
              [
                "VPS_USER",
                "same",
                "New server uses a different SSH user (example default: deploy; many boxes use root)",
              ],
              [
                "VPS_SSH_KEY",
                "same",
                "Different key pair or operator machine",
              ],
              [
                "VPS_DEPLOY_PATH",
                "same",
                "Install path differs from /opt/tmc",
              ],
              [
                "WEBSITE_DOMAIN",
                "config/platform.env (fallback: deploy/runtime-config/production.json)",
                "Pure VPS swap with same domain — unchanged; only DNS A records move",
              ],
            ]}
          />
          <DocCallout variant="warning">
            Do <strong>not</strong> put <DocCode>VPS_*</DocCode> or SSH keys
            into <DocCode>config/platform.env</DocCode>. The deploy adapter reads{" "}
            <DocCode>deploy/provider.credentials.env</DocCode> only (
            <DocCode>deploy/adapters/docker-vps.mjs</DocCode>).
          </DocCallout>
          <DocP>
            <DocCode>deploy/manifest.production.json</DocCode> stays the same
            for VPS-to-VPS moves:{" "}
            <DocCode>provider: docker-vps</DocCode>,{" "}
            <DocCode>topology: micro</DocCode>,{" "}
            <DocCode>data.mode: external</DocCode>. See{" "}
            <DocLink href="/documentation/configuration">
              Configuration & Environment
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "vps-to-vps",
      title: "VPS provider → VPS provider",
      content: (
        <>
          <DocP>
            Examples: DigitalOcean → Hetzner, DigitalOcean → Hostinger VPS,
            DigitalOcean → FlokiNet, or any VPS → another VPS. Docker, Caddy,{" "}
            topology, and application architecture <strong>remain unchanged</strong>.
            External Neon Postgres and Upstash Redis are unchanged.
          </DocP>
          <DocCallout variant="tip">
            For a pure hosting swap with the same domain, you normally change
            only <DocCode>VPS_HOST</DocCode> in{" "}
            <DocCode>deploy/provider.credentials.env</DocCode>, update DNS, and
            redeploy.
          </DocCallout>
          <DocTable
            headers={["Unchanged", "You change"]}
            rows={[
              [
                "Docker images, Caddy, micro topology, app code, Neon, Upstash, WEBSITE_DOMAIN, manifest",
                "VPS_HOST (+ VPS_USER / VPS_SSH_KEY / VPS_DEPLOY_PATH if needed), DNS A records",
              ],
            ]}
          />
          <DocP>
            Changing hostname (not just the server)? Use{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>{" "}
            instead — that updates <DocCode>WEBSITE_DOMAIN</DocCode> and
            recompiles Caddy.
          </DocP>
        </>
      ),
    },
    {
      id: "server-replacement",
      title: "VPS / server replacement",
      content: (
        <>
          <DocP>
            Replacing a droplet (same or different provider) follows the same
            flow as VPS → VPS.
          </DocP>
          <DocFlow
            steps={[
              "Provision new server; note public IP.",
              "Update deploy/provider.credentials.env (VPS_HOST, and user/key/path if needed).",
              "First deploy: ./deploy.sh production --fresh --provider docker-vps --confirm-external-data",
              "Update DNS: apex (@) and api A records → new IP (lower TTL before cutover if possible).",
              "Wait for DNS + Caddy ACME (Let's Encrypt on new box).",
              "Verify API and wallet BFF endpoints (see Verification).",
              "After stable traffic, destroy old droplet.",
            ]}
          />
          <DocP>
            <DocCode>--confirm-external-data</DocCode> is required when{" "}
            <DocCode>data.mode: external</DocCode> and{" "}
            <DocCode>DATABASE_URL</DocCode> points at a protected host (e.g.{" "}
            <DocCode>neon.tech</DocCode>). It allows migrate deploy against the
            existing database — it does <strong>not</strong> wipe Neon or
            Upstash.
          </DocP>
        </>
      ),
    },
    {
      id: "new-server-prerequisites",
      title: "New server prerequisites",
      content: (
        <>
          <DocP>
            On <DocCode>--fresh</DocCode>, the adapter runs{" "}
            <DocCode>deploy/scripts/provision-vps-docker.sh</DocCode> over SSH
            (Debian/Ubuntu: Docker Engine + compose plugin). The VPS never runs{" "}
            <DocCode>npm</DocCode> or <DocCode>docker build</DocCode> — images
            are built locally and streamed via{" "}
            <DocCode>docker save | ssh docker load</DocCode>.
          </DocP>
          <DocTable
            headers={["Requirement", "Detail"]}
            rows={[
              ["SSH", "Key in VPS_SSH_KEY; user in VPS_USER"],
              ["Ports", "80 and 443 open (Caddy / ACME)"],
              ["Egress", "Internet for ACME, Neon, Upstash"],
              ["RAM", "512 MB+ recommended; 1 GB swap on small boxes"],
              ["Deploy path", "Default /opt/tmc (VPS_DEPLOY_PATH)"],
            ]}
          />
        </>
      ),
    },
    {
      id: "docker-caddy",
      title: "Docker & Caddy on the new server",
      content: (
        <>
          <DocP>
            <strong>What stays the same:</strong> image definitions (
            <DocCode>deploy/docker/</DocCode>), compose stacks (
            <DocCode>deploy/compose/docker-compose.micro*.yml</DocCode>),
            container layout (backend + wallet + caddy).
          </DocP>
          <DocP>
            <strong>What is configured on the new server:</strong> Docker
            (provision script), rsynced deploy bundle under{" "}
            <DocCode>VPS_DEPLOY_PATH</DocCode>, compiled env in{" "}
            <DocCode>deploy/compiled/production/</DocCode>, and a{" "}
            <strong>compiler-generated</strong> Caddyfile from{" "}
            <DocCode>WEBSITE_DOMAIN</DocCode> (
            <DocCode>deploy/caddy/Caddyfile</DocCode> template — do not hand-edit
            hostnames).
          </DocP>
          <DocP>
            Caddy requests new Let&apos;s Encrypt certificates after DNS points
            to the new IP. Allow a few minutes after cutover.
          </DocP>
        </>
      ),
    },
    {
      id: "data-layer",
      title: "Database & Redis",
      content: (
        <>
          <DocP>
            Current production uses <DocCode>data.mode: external</DocCode> in
            the manifest — Postgres (Neon) and Redis (Upstash) live outside the
            VPS.
          </DocP>
          <DocCallout variant="tip">
            A VPS-only move does <strong>not</strong> require database or Redis
            migration. The new server uses the same{" "}
            <DocCode>DATABASE_URL</DocCode> and <DocCode>REDIS_URL</DocCode> from{" "}
            <DocCode>env/profiles/production/backend.env</DocCode>.
          </DocCallout>
          <DocP>
            Runtime config on the VPS (
            <DocCode>/opt/tmc/deploy/runtime-config/production.json</DocCode>)
            is rsynced during deploy. Back up before migration; push with{" "}
            <DocCode>npm run config:sync-vps</DocCode> when needed.
          </DocP>
        </>
      ),
    },
    {
      id: "dns-ssl",
      title: "DNS & SSL",
      content: (
        <>
          <DocTable
            headers={["Record", "Target"]}
            rows={[
              ["Apex (@)", "New VPS public IP"],
              ["api", "Same new VPS IP"],
              ["www (optional)", "New VPS IP or CNAME per your layout"],
            ]}
          />
          <DocP>
            TLS is automatic via Caddy + Let&apos;s Encrypt on the VPS (ports
            80/443). No manual certificate upload for the micro stack.
          </DocP>
          <DocP>
            <strong>Cloudflare (recommended):</strong> point apex,{" "}
            <DocCode>api</DocCode>, and <DocCode>www</DocCode> A records to the
            VPS IP. Use grey-cloud first to verify Caddy TLS, then optional
            orange-cloud proxy. Full guide:{" "}
            <DocCode>docs/infrastructure/cloudflare-setup.md</DocCode> and{" "}
            <DocLink href="/documentation/deployment#cloudflare">
              Deployment → Cloudflare DNS &amp; proxy
            </DocLink>
            .
          </DocP>
          <DocP>
            Hostname change (not just IP)? See{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "deploy-steps",
      title: "Deploy & redeploy",
      content: (
        <>
          <DocPre>{`# Update credentials
# deploy/provider.credentials.env → VPS_HOST (and user/key/path if needed)

# First deploy to a new box (install Docker, sync bundle, start stack)
./deploy.sh production --fresh --provider docker-vps --confirm-external-data

# Subsequent code/image deploys
./deploy.sh production --provider docker-vps

# Config-only (reuse images on VPS — domain/pixel change)
./deploy.sh production --provider docker-vps --skip-images`}</DocPre>
          <DocP>
            Full command reference:{" "}
            <DocLink href="/documentation/commands">Command Reference</DocLink>
            . Pipeline details: <DocCode>deploy/README.md</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "verification-rollback",
      title: "Verification & rollback",
      content: (
        <>
          <DocP>
            Deploy runs automated checks (
            <DocCode>deploy/core/verify.mjs</DocCode>):
          </DocP>
          <DocTable
            headers={["Check", "URL"]}
            rows={[
              [
                "API public settings",
                "https://api.&lt;WEBSITE_DOMAIN&gt;/v1/api/settings/public",
              ],
              [
                "Wallet BFF",
                "https://&lt;WEBSITE_DOMAIN&gt;/api/settings/public",
              ],
            ]}
          />
          <DocP>
            Manual: HTTPS on apex and <DocCode>api.</DocCode>, WalletConnect on{" "}
            <DocCode>/</DocCode>, admin locally against production API.
          </DocP>
          <DocP>
            <strong>Rollback:</strong> If the new VPS fails before decommissioning
            the old one, revert DNS A records to the <strong>old</strong> IP.
            The previous stack serves until TTL expires. Restore{" "}
            <DocCode>VPS_HOST</DocCode> in credentials if you return to the old
            box.
          </DocP>
        </>
      ),
    },
    {
      id: "vps-to-render",
      title: "VPS → Render migration",
      content: (
        <>
          <DocCallout variant="warning">
            Render is a <strong>different deployment path</strong>. The VPS
            migration steps above do <strong>not</strong> apply directly.
            <DocCode>./deploy.sh --provider render</DocCode> is a{" "}
            <strong>stub</strong> (not implemented).
          </DocCallout>
          <DocTable
            headers={["Aspect", "Micro VPS", "Render"]}
            rows={[
              [
                "Deploy",
                "./deploy.sh --provider docker-vps",
                "Render Dashboard + render-budget.yaml or render.yaml",
              ],
              ["TLS", "Caddy on VPS", "Render-managed on custom domains"],
              [
                "Build",
                "Local Docker → SSH stream",
                "scripts/render-build-*.sh on Render",
              ],
              [
                "Public URLs",
                "Compiled from WEBSITE_DOMAIN",
                "Manual APP_ORIGIN, BACKEND_API_URL, NEXT_PUBLIC_* in dashboard",
              ],
              ["DNS", "A records → VPS IP", "CNAME targets from Render"],
              ["Admin", "localhost:3002", "Budget: local; full blueprint: Render service"],
            ]}
          />
          <DocFlow
            steps={[
              "Create or reuse Neon + Upstash; attach DATABASE_URL / REDIS_URL to Render services.",
              "Deploy blueprint: render-budget.yaml (~$14/mo) or render.yaml (full split).",
              "Set per-service env vars in Render dashboard (see render-budget-production.md).",
              "Add custom domains on each Render service; update DNS to Render CNAMEs.",
              "Rebuild wallet after NEXT_PUBLIC_* changes.",
              "Update WalletConnect allowed origin.",
              "Verify cutover; decommission VPS stack.",
            ]}
          />
          <DocP>
            Do not copy <DocCode>VPS_*</DocCode> into Render. See{" "}
            <DocLink href="/documentation/deployment">
              Deployment & Infrastructure
            </DocLink>{" "}
            and <DocCode>docs/infrastructure/render-budget-production.md</DocCode>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "quick-reference",
      title: "Quick reference",
      content: (
        <DocTable
          headers={["Scenario", "VPS_HOST", "WEBSITE_DOMAIN", "DNS", "Deploy"]}
          rows={[
            [
              "Same domain, new VPS",
              "Yes",
              "No",
              "A → new IP",
              "--fresh --confirm-external-data, then normal deploys",
            ],
            [
              "New domain, same VPS",
              "No",
              "Yes",
              "See Domain Migration",
              "config-update.sh domain + config-only deploy",
            ],
            [
              "VPS → Render",
              "N/A",
              "Maybe",
              "CNAME to Render",
              "Render blueprint + dashboard env",
            ],
          ]}
        />
      ),
    },
  ],
};
