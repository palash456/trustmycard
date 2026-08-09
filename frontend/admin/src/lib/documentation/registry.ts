import { adminPanelPage } from "./pages/admin-panel";
import { apiPage } from "./pages/api";
import { architecturePage } from "./pages/architecture";
import { backendPage } from "./pages/backend";
import { blockchainPage } from "./pages/blockchain";
import { configurationPage } from "./pages/configuration";
import { dataFlowsPage } from "./pages/data-flows";
import { databasePage } from "./pages/database";
import { deploymentPage } from "./pages/deployment";
import { frontendPage } from "./pages/frontend";
import { idsCorrelationPage } from "./pages/ids-correlation";
import { observabilityPage } from "./pages/observability";
import { overviewPage } from "./pages/overview";
import { securityPage } from "./pages/security";
import { systemDesignPage } from "./pages/system-design";
import { testingPage } from "./pages/testing";
import { transactionLifecyclePage } from "./pages/transaction-lifecycle";
import { troubleshootingPage } from "./pages/troubleshooting";
import { walletFlowsPage } from "./pages/wallet-flows";
import { workersPage } from "./pages/workers";
import type { DocNavGroup, DocPage, TocEntry } from "./types";

export const DOC_PAGES: DocPage[] = [
  overviewPage,
  systemDesignPage,
  architecturePage,
  frontendPage,
  backendPage,
  databasePage,
  apiPage,
  walletFlowsPage,
  transactionLifecyclePage,
  idsCorrelationPage,
  blockchainPage,
  workersPage,
  adminPanelPage,
  observabilityPage,
  securityPage,
  configurationPage,
  deploymentPage,
  testingPage,
  troubleshootingPage,
  dataFlowsPage,
];

export const DOC_NAV_GROUPS: DocNavGroup[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      {
        slug: "overview",
        title: "System Overview",
        keywords: overviewPage.keywords,
      },
      {
        slug: "system-design",
        title: "System Design & Tech Stack",
        keywords: systemDesignPage.keywords,
      },
      {
        slug: "architecture",
        title: "Architecture",
        keywords: architecturePage.keywords,
      },
      {
        slug: "data-flows",
        title: "Data Flows",
        keywords: dataFlowsPage.keywords,
      },
    ],
  },
  {
    id: "codebase",
    title: "Codebase",
    items: [
      {
        slug: "frontend",
        title: "Frontend Structure",
        keywords: frontendPage.keywords,
      },
      {
        slug: "backend",
        title: "Backend Structure",
        keywords: backendPage.keywords,
      },
      {
        slug: "database",
        title: "Database & Schema",
        keywords: databasePage.keywords,
      },
      { slug: "api", title: "API Reference", keywords: apiPage.keywords },
    ],
  },
  {
    id: "core-flows",
    title: "Core Flows",
    items: [
      {
        slug: "wallet-flows",
        title: "Wallet & Connect",
        keywords: walletFlowsPage.keywords,
      },
      {
        slug: "transaction-lifecycle",
        title: "Transaction Lifecycle",
        keywords: transactionLifecyclePage.keywords,
      },
      {
        slug: "ids-and-correlation",
        title: "IDs & Correlation",
        keywords: idsCorrelationPage.keywords,
      },
      {
        slug: "blockchain",
        title: "Blockchain & Networks",
        keywords: blockchainPage.keywords,
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    items: [
      {
        slug: "workers-and-queues",
        title: "Workers & Queues",
        keywords: workersPage.keywords,
      },
      {
        slug: "admin-panel",
        title: "Admin Panel Guide",
        keywords: adminPanelPage.keywords,
      },
      {
        slug: "observability",
        title: "Logging & Observability",
        keywords: observabilityPage.keywords,
      },
      { slug: "security", title: "Security", keywords: securityPage.keywords },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    items: [
      {
        slug: "configuration",
        title: "Configuration",
        keywords: configurationPage.keywords,
      },
      {
        slug: "deployment",
        title: "Deployment",
        keywords: deploymentPage.keywords,
      },
      { slug: "testing", title: "Testing", keywords: testingPage.keywords },
      {
        slug: "troubleshooting",
        title: "Troubleshooting",
        keywords: troubleshootingPage.keywords,
      },
    ],
  },
];

export const DEFAULT_DOC_SLUG = "overview";

export function getDocPage(slug: string | undefined): DocPage | undefined {
  const resolved = slug || DEFAULT_DOC_SLUG;
  return DOC_PAGES.find((page) => page.slug === resolved);
}

export function buildTocEntries(page: DocPage): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const section of page.sections) {
    entries.push({ id: section.id, title: section.title, level: 2 });
    for (const subsection of section.subsections ?? []) {
      entries.push({ id: subsection.id, title: subsection.title, level: 3 });
    }
  }
  return entries;
}

export function docHref(slug: string, sectionId?: string): string {
  const base = `/documentation/${slug}`;
  return sectionId ? `${base}#${sectionId}` : base;
}
