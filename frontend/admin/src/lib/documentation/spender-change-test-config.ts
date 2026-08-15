import type { SpenderChangeInput } from "@/lib/spender-change-test/inputs";

export type SpenderChangeTestStep = {
  id: string;
  step: string;
  action: string;
  expected: string;
  kind: "browser" | "terminal" | "dashboard" | "manual";
};

export type SpenderChangeTestPhase = {
  id: string;
  title: string;
  description: string;
  steps: SpenderChangeTestStep[];
};

export type SpenderChangeTestConfig = {
  title: string;
  subtitle: string;
  prerequisites: string[];
  phases: SpenderChangeTestPhase[];
  passCriteria: string[];
  failActions: string[];
};

function backendPublicSettingsUrl(backendBase: string): string {
  return `${backendBase.replace(/\/$/, "")}/v1/api/settings/public`;
}

function websitePublicSettingsUrl(websiteBase: string): string {
  return `${websiteBase.replace(/\/$/, "")}/api/settings/public`;
}

export function buildSpenderChangeTest(
  input: SpenderChangeInput,
): SpenderChangeTestConfig {
  const shortEvm = `${input.oldSpenderEvm.slice(0, 8)}… → ${input.newSpenderEvm.slice(0, 8)}…`;
  const shortTron = `${input.oldSpenderTron.slice(0, 6)}… → ${input.newSpenderTron.slice(0, 6)}…`;

  const phases: SpenderChangeTestPhase[] = [
    {
      id: "phase-a",
      title: "Phase A — Keys & addresses",
      description:
        "Confirms new spender addresses are valid and optional private keys derive to them.",
      steps: [
        {
          id: "a1",
          step: "A1",
          action: "Derive EVM address from new ADMIN_EVM_PRIVATE_KEY (if provided)",
          expected: `Derived address equals ${input.newSpenderEvm}`,
          kind: "terminal",
        },
        {
          id: "a2",
          step: "A2",
          action: "Derive TRON address from new ADMIN_TRON_PRIVATE_KEY (if provided)",
          expected: `Derived address equals ${input.newSpenderTron}`,
          kind: "terminal",
        },
        {
          id: "a3",
          step: "A3",
          action: "Compare old vs new EVM spender addresses",
          expected: "Addresses differ (rotation, not a no-op)",
          kind: "manual",
        },
        {
          id: "a4",
          step: "A4",
          action: "Compare old vs new TRON spender addresses",
          expected: "Addresses differ (rotation, not a no-op)",
          kind: "manual",
        },
      ],
    },
    {
      id: "phase-b",
      title: `Phase B — Dev backend (${input.devBackendUrl})`,
      description:
        "Local development backend must expose new spenders and report spenderMatch.",
      steps: [
        {
          id: "b1",
          step: "B1",
          action: `GET ${backendPublicSettingsUrl(input.devBackendUrl)}`,
          expected: `spenderEvm = ${input.newSpenderEvm} (not old)`,
          kind: "terminal",
        },
        {
          id: "b2",
          step: "B2",
          action: `GET ${backendPublicSettingsUrl(input.devBackendUrl)}`,
          expected: `spenderTron = ${input.newSpenderTron} (not old)`,
          kind: "terminal",
        },
        {
          id: "b3",
          step: "B3",
          action: `GET ${input.devBackendUrl}/v1/api/admin/system/status`,
          expected: "secrets.evm.spenderMatch === true",
          kind: "terminal",
        },
        {
          id: "b4",
          step: "B4",
          action: `GET ${input.devBackendUrl}/v1/api/admin/system/status`,
          expected: "secrets.tron.spenderMatch === true",
          kind: "terminal",
        },
        {
          id: "b5",
          step: "B5",
          action: "Dev system status spender addresses",
          expected: `EVM = ${input.newSpenderEvm}, TRON = ${input.newSpenderTron}`,
          kind: "terminal",
        },
        {
          id: "b6",
          step: "B6",
          action: "Dev public config must not return old spenders",
          expected: `No ${input.oldSpenderEvm} or ${input.oldSpenderTron} in response`,
          kind: "terminal",
        },
      ],
    },
  ];

  if (input.websiteUrl) {
    phases.push({
      id: "phase-c",
      title: `Phase C — Website BFF (${input.websiteUrl})`,
      description:
        "Website proxies public platform config — must match backend after restart.",
      steps: [
        {
          id: "c1",
          step: "C1",
          action: `GET ${websitePublicSettingsUrl(input.websiteUrl)}`,
          expected: `config.wallets.spenderEvm = ${input.newSpenderEvm}`,
          kind: "terminal",
        },
        {
          id: "c2",
          step: "C2",
          action: `GET ${websitePublicSettingsUrl(input.websiteUrl)}`,
          expected: `config.wallets.spenderTron = ${input.newSpenderTron}`,
          kind: "terminal",
        },
      ],
    });
  }

  if (input.prodBackendUrl) {
    phases.push({
      id: "phase-d",
      title: `Phase D — Production backend (${input.prodBackendUrl})`,
      description:
        "Live backend (Render tmc-api) must expose new spenders; worker keys must match.",
      steps: [
        {
          id: "d1",
          step: "D1",
          action: `GET ${backendPublicSettingsUrl(input.prodBackendUrl)}`,
          expected: `spenderEvm = ${input.newSpenderEvm}`,
          kind: "terminal",
        },
        {
          id: "d2",
          step: "D2",
          action: `GET ${backendPublicSettingsUrl(input.prodBackendUrl)}`,
          expected: `spenderTron = ${input.newSpenderTron}`,
          kind: "terminal",
        },
        {
          id: "d3",
          step: "D3",
          action: "Production system status EVM spenderMatch",
          expected: "secrets.evm.spenderMatch === true (worker env)",
          kind: "terminal",
        },
        {
          id: "d4",
          step: "D4",
          action: "Production system status TRON spenderMatch",
          expected: "secrets.tron.spenderMatch === true (worker env)",
          kind: "terminal",
        },
        {
          id: "d5",
          step: "D5",
          action: "Production system status spender addresses",
          expected: `EVM + TRON match new spenders`,
          kind: "terminal",
        },
        {
          id: "d6",
          step: "D6",
          action: "Production public config stale check",
          expected: "Old spenders not returned",
          kind: "terminal",
        },
      ],
    });
  }

  phases.push({
    id: "phase-f",
    title: "Phase F — Cross-environment stale check",
    description:
      "Aggregates all checked endpoints — none may still serve old spender addresses.",
    steps: [
      {
        id: "f1",
        step: "F1",
        action: "Scan all configured backend + website endpoints",
        expected: `No endpoint returns old EVM ${input.oldSpenderEvm}`,
        kind: "terminal",
      },
      {
        id: "f2",
        step: "F2",
        action: "Scan all configured backend + website endpoints",
        expected: `No endpoint returns old TRON ${input.oldSpenderTron}`,
        kind: "terminal",
      },
    ],
  });

  phases.push({
    id: "phase-g",
    title: "Phase G — Manual confirmations",
    description:
      "Env files, Render secrets, funding, and connect-flow smoke test.",
    steps: [
      {
        id: "g1",
        step: "G1",
        action:
          "Verify env/profiles/{development,production-preview,production}/platform.env",
        expected:
          "SPENDER_EVM, SPENDER_TRON, ADMIN_EVM_PRIVATE_KEY, ADMIN_TRON_PRIVATE_KEY updated",
        kind: "dashboard",
      },
      {
        id: "g2",
        step: "G2",
        action: "Render: tmc-api SPENDER_* + tmc-workers ADMIN_*_PRIVATE_KEY",
        expected: "Redeployed after env change; no stale values in dashboard",
        kind: "dashboard",
      },
      {
        id: "g3",
        step: "G3",
        action: "Fund new spender wallets with gas (EVM native + TRX)",
        expected: "Sufficient balance for approve collection and native transfers",
        kind: "manual",
      },
      {
        id: "g4",
        step: "G4",
        action: "Connect flow: new approval on /",
        expected: `Approval.spenderAddress = ${input.newSpenderEvm} or ${input.newSpenderTron}`,
        kind: "manual",
      },
      {
        id: "g5",
        step: "G5",
        action: "Legacy approvals on old spender",
        expected:
          "Keep old private keys if collecting legacy on-chain allowances",
        kind: "manual",
      },
    ],
  });

  return {
    title: `Spender rotation verification — ${shortEvm}; ${shortTron}`,
    subtitle:
      "Run after updating platform.env and redeploying backend + website. Passes only when all automated checks pass.",
    prerequisites: [
      "Updated env/profiles/$TMC_ENV/platform.env with SPENDER_* and ADMIN_*_PRIVATE_KEY.",
      "Restarted local backend + website (or redeployed Render services).",
      "Enter old and new spender addresses below — optional new private keys verify key↔address match.",
      "Add production backend URL to verify live environment.",
    ],
    phases,
    passCriteria: [
      "New private keys (if provided) derive to new spender addresses.",
      "Dev backend public settings and system status report new spenders with spenderMatch: true.",
      "Website BFF (if configured) matches backend public config.",
      "Production backend (if configured) uses new spenders — no stale old addresses.",
      "Manual: env files, Render secrets, gas funding, and one new approval confirmed.",
    ],
    failActions: [
      "Re-check platform.env — SPENDER_* must match ADMIN_*_PRIVATE_KEY derivation.",
      "Restart backend and website after env changes.",
      "On Render: SPENDER_* on tmc-api; ADMIN_*_PRIVATE_KEY on tmc-workers only.",
      "Clear any legacy NEXT_PUBLIC_SPENDER_* that conflict with SPENDER_*.",
      "See Troubleshooting on this page for specific failure fixes.",
    ],
  };
}

export const SPENDER_CHANGE_TEST_STEP_IDS = [
  "a1",
  "a2",
  "a3",
  "a4",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "c1",
  "c2",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "f1",
  "f2",
  "g1",
  "g2",
  "g3",
  "g4",
  "g5",
] as const;
