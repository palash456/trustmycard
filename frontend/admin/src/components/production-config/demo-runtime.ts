import type { ConfigField } from "./field-config";

export type DemoConfigState = {
  WEBSITE_DOMAIN: string;
  META_PIXEL_ID: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  lastSource: string;
  lastChangeId: string;
  platformDefaultsActive?: boolean;
  source?: string;
};

export type DemoConfigAudit = {
  changeId: string;
  key: string;
  priorValue: string | null;
  finalValue: string | null;
  actor: string;
  source: string;
  completedAt: string;
  result: string;
};

export type DemoDeployEvent = {
  phase: string;
  message?: string;
  at: string;
  changeId?: string;
  error?: string;
};

export const DEMO_ROLLBACK_DOMAIN = "https://rollback.demo.example.com";
export const DEMO_ROLLBACK_PIXEL = "000000000000001";

const DEMO_ACTOR = "demo@trustmycard.admin";

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function createDemoRuntime(): {
  state: DemoConfigState;
  history: DemoConfigAudit[];
} {
  return {
    state: {
      WEBSITE_DOMAIN: "exampleUrl.com",
      META_PIXEL_ID: "123456789012345",
      lastUpdatedAt: daysAgo(2),
      lastUpdatedBy: "ops@exampleUrl.com",
      lastSource: "CLI",
      lastChangeId: "cfg-demo-initial",
      source: "RUNTIME",
    },
    history: [
      {
        changeId: "cfg-demo-h-001",
        key: "WEBSITE_DOMAIN",
        priorValue: "https://legacy.example.com",
        finalValue: "https://exampleUrl.com",
        actor: "ops@exampleUrl.com",
        source: "ADMIN_PORTAL",
        completedAt: daysAgo(14),
        result: "SUCCESS",
      },
      {
        changeId: "cfg-demo-h-002",
        key: "META_PIXEL_ID",
        priorValue: "111111111111111",
        finalValue: "123456789012345",
        actor: "marketing@exampleUrl.com",
        source: "ADMIN_PORTAL",
        completedAt: daysAgo(7),
        result: "SUCCESS",
      },
      {
        changeId: "cfg-demo-h-003",
        key: "META_PIXEL_ID",
        priorValue: "123456789012345",
        finalValue: "999999999999999",
        actor: "demo.reviewer@exampleUrl.com",
        source: "ADMIN_PORTAL",
        completedAt: daysAgo(3),
        result: "ROLLED_BACK",
      },
      {
        changeId: "cfg-demo-h-004",
        key: "WEBSITE_DOMAIN",
        priorValue: "https://exampleUrl.com",
        finalValue: "https://staging.exampleUrl.com",
        actor: "ops@exampleUrl.com",
        source: "CLI",
        completedAt: daysAgo(1),
        result: "ROLLED_BACK",
      },
    ],
  };
}

export function isDemoRollbackScenario(
  field: ConfigField,
  rawValue: string,
): boolean {
  const value = rawValue.trim().toLowerCase();
  if (field === "domain") {
    return value.includes("rollback.demo");
  }
  return value === DEMO_ROLLBACK_PIXEL || value === "999999999999999";
}

export function allocateDemoChangeId(): string {
  return `cfg-demo-${Date.now().toString(36)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateDemoConfigDeploy({
  field,
  rawValue,
  changeId,
  onEvent,
}: {
  field: ConfigField;
  rawValue: string;
  changeId: string;
  onEvent: (event: DemoDeployEvent) => void;
}): Promise<{ success: boolean; finalValue: string; result: string }> {
  const rollback = isDemoRollbackScenario(field, rawValue);
  const finalValue =
    field === "domain"
      ? rawValue.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
      : rawValue.trim();

  const emit = (phase: string, message?: string, error?: string) => {
    onEvent({
      phase,
      message,
      error,
      changeId,
      at: new Date().toISOString(),
    });
  };

  const steps: Array<{ phase: string; message: string; ms: number }> = [
    { phase: "read", message: "Loading runtime state", ms: 450 },
    { phase: "validation", message: "Validating requested configuration", ms: 500 },
    { phase: "preflight", message: "Compiling configuration", ms: 600 },
    { phase: "apply", message: "Writing runtime state (demo — no files changed)", ms: 500 },
    {
      phase: "restart",
      message:
        field === "domain"
          ? "Simulating config-only release: caddy, backend, wallet"
          : "Simulating config-only release: wallet",
      ms: 700,
    },
    {
      phase: "verify",
      message: rollback
        ? "Verification failed — public settings did not match expected value"
        : "Verifying updated configuration",
      ms: 650,
    },
  ];

  for (const step of steps) {
    emit(step.phase, step.message);
    await delay(step.ms);
  }

  if (rollback) {
    emit("rollback", "Restoring prior configuration (demo simulation)");
    await delay(550);
    emit("verify", "Verifying rolled back configuration");
    await delay(450);
    emit(
      "complete",
      "ROLLED_BACK",
      "Demo rollback: verification failed and prior value was restored.",
    );
    return { success: false, finalValue, result: "ROLLED_BACK" };
  }

  emit("complete", "SUCCESS");
  return { success: true, finalValue, result: "SUCCESS" };
}

export function buildDemoAuditEntry({
  field,
  priorValue,
  finalValue,
  changeId,
  result,
}: {
  field: ConfigField;
  priorValue: string;
  finalValue: string;
  changeId: string;
  result: string;
}): DemoConfigAudit {
  return {
    changeId,
    key: field === "domain" ? "WEBSITE_DOMAIN" : "META_PIXEL_ID",
    priorValue,
    finalValue: result === "SUCCESS" ? finalValue : priorValue,
    actor: DEMO_ACTOR,
    source: "ADMIN_PORTAL_DEMO",
    completedAt: new Date().toISOString(),
    result,
  };
}
