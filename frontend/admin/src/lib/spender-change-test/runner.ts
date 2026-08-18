import type { PublicPlatformConfigResponse } from "@trustmycard/shared/platform-config";
import {
  deriveEvmAddress,
  deriveTronAddress,
} from "@/lib/spender-change-test/crypto";
import type { SpenderChangeInput } from "@/lib/spender-change-test/inputs";

const FETCH_TIMEOUT_MS = 20_000;

export type SpenderChangeStepStatus = "pass" | "fail" | "skip";

export type SpenderChangeStepResult = {
  id: string;
  step: string;
  status: SpenderChangeStepStatus;
  message: string;
  detail?: string;
};

export type SpenderChangeTestRunSummary = {
  results: SpenderChangeStepResult[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  allAutomatedPassed: boolean;
  input: SpenderChangeInput;
};

type SystemStatusSecrets = {
  evm?: {
    configured?: boolean;
    spenderAddress?: string | null;
    spenderMatch?: boolean;
  };
  tron?: {
    configured?: boolean;
    spenderAddress?: string | null;
    spenderMatch?: boolean;
  };
};

type SystemStatusResponse = {
  secrets?: SystemStatusSecrets;
};

type RunnerSecrets = {
  devAdminApiKey: string;
  prodAdminApiKey: string;
};

function pass(
  id: string,
  step: string,
  message: string,
  detail?: string,
): SpenderChangeStepResult {
  return { id, step, status: "pass", message, detail };
}

function fail(
  id: string,
  step: string,
  message: string,
  detail?: string,
): SpenderChangeStepResult {
  return { id, step, status: "fail", message, detail };
}

function skip(
  id: string,
  step: string,
  message: string,
  detail?: string,
): SpenderChangeStepResult {
  return { id, step, status: "skip", message, detail };
}

async function timedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublicConfig(
  apiBase: string,
): Promise<{
  ok: boolean;
  config?: PublicPlatformConfigResponse;
  error?: string;
}> {
  const url = `${apiBase.replace(/\/$/, "")}/v1/api/settings/public`;
  try {
    const response = await timedFetch(url, {
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = JSON.parse(text) as PublicPlatformConfigResponse;
    return { ok: true, config: json };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchWebsitePublicConfig(
  websiteBase: string,
): Promise<{
  ok: boolean;
  config?: PublicPlatformConfigResponse;
  error?: string;
}> {
  const url = `${websiteBase.replace(/\/$/, "")}/api/settings/public`;
  try {
    const response = await timedFetch(url, {
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = JSON.parse(text) as PublicPlatformConfigResponse;
    return { ok: true, config: json };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchSystemStatus(
  apiBase: string,
  adminApiKey: string,
): Promise<{ ok: boolean; status?: SystemStatusResponse; error?: string }> {
  if (!adminApiKey) {
    return {
      ok: false,
      error: "Admin API key not configured for this environment",
    };
  }
  const url = `${apiBase.replace(/\/$/, "")}/v1/api/admin/system/status`;
  try {
    const response = await timedFetch(url, {
      headers: {
        Accept: "application/json",
        "x-admin-api-key": adminApiKey,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }
    return { ok: true, status: JSON.parse(text) as SystemStatusResponse };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function evmEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function testKeyDerivation(
  input: SpenderChangeInput,
): SpenderChangeStepResult[] {
  const results: SpenderChangeStepResult[] = [];

  if (input.newEvmPrivateKey) {
    const derived = deriveEvmAddress(input.newEvmPrivateKey);
    if (!derived) {
      results.push(
        fail("a1", "A1", "Could not derive EVM address from private key"),
      );
    } else if (evmEqual(derived, input.newSpenderEvm)) {
      results.push(
        pass(
          "a1",
          "A1",
          "New EVM private key derives to new spender address",
          derived,
        ),
      );
    } else {
      results.push(
        fail(
          "a1",
          "A1",
          "New EVM private key does not match new spender address",
          `Derived ${derived}, expected ${input.newSpenderEvm}`,
        ),
      );
    }
  } else {
    results.push(
      skip(
        "a1",
        "A1",
        "Skipped — paste new ADMIN_EVM_PRIVATE_KEY to verify derivation",
      ),
    );
  }

  if (input.newTronPrivateKey) {
    const derived = deriveTronAddress(input.newTronPrivateKey);
    if (!derived) {
      results.push(
        fail("a2", "A2", "Could not derive TRON address from private key"),
      );
    } else if (derived === input.newSpenderTron) {
      results.push(
        pass(
          "a2",
          "A2",
          "New TRON private key derives to new spender address",
          derived,
        ),
      );
    } else {
      results.push(
        fail(
          "a2",
          "A2",
          "New TRON private key does not match new spender address",
          `Derived ${derived}, expected ${input.newSpenderTron}`,
        ),
      );
    }
  } else {
    results.push(
      skip(
        "a2",
        "A2",
        "Skipped — paste new ADMIN_TRON_PRIVATE_KEY to verify derivation",
      ),
    );
  }

  results.push(
    pass(
      "a3",
      "A3",
      "Old and new EVM spenders differ",
      `${input.oldSpenderEvm} → ${input.newSpenderEvm}`,
    ),
  );
  results.push(
    pass(
      "a4",
      "A4",
      "Old and new TRON spenders differ",
      `${input.oldSpenderTron} → ${input.newSpenderTron}`,
    ),
  );

  return results;
}

type EnvCheckIds = {
  publicEvm: string;
  publicTron: string;
  matchEvm: string;
  matchTron: string;
  statusAddresses: string;
  stale: string;
  stepPrefix: string;
};

async function testEnvironment(
  input: SpenderChangeInput,
  apiBase: string,
  adminApiKey: string,
  label: string,
  ids: EnvCheckIds,
): Promise<SpenderChangeStepResult[]> {
  const results: SpenderChangeStepResult[] = [];
  const publicResult = await fetchPublicConfig(apiBase);

  if (!publicResult.ok || !publicResult.config?.config?.wallets) {
    results.push(
      fail(
        ids.publicEvm,
        `${ids.stepPrefix}1`,
        `${label} public settings unreachable`,
        publicResult.error,
      ),
    );
    results.push(
      fail(
        ids.publicTron,
        `${ids.stepPrefix}2`,
        `${label} public settings unreachable`,
      ),
    );
    results.push(
      skip(ids.matchEvm, `${ids.stepPrefix}3`, "Skipped — public API failed"),
    );
    results.push(
      skip(ids.matchTron, `${ids.stepPrefix}4`, "Skipped — public API failed"),
    );
    results.push(
      skip(
        ids.statusAddresses,
        `${ids.stepPrefix}5`,
        "Skipped — public API failed",
      ),
    );
    results.push(
      skip(ids.stale, `${ids.stepPrefix}6`, "Skipped — public API failed"),
    );
    return results;
  }

  const wallets = publicResult.config.config.wallets;
  const evm = wallets.spenderEvm ?? "";
  const tron = wallets.spenderTron ?? "";

  if (
    evmEqual(evm, input.newSpenderEvm) &&
    !evmEqual(evm, input.oldSpenderEvm)
  ) {
    results.push(
      pass(
        ids.publicEvm,
        `${ids.stepPrefix}1`,
        `${label} public spenderEvm is the new address`,
        evm,
      ),
    );
  } else if (evmEqual(evm, input.oldSpenderEvm)) {
    results.push(
      fail(
        ids.publicEvm,
        `${ids.stepPrefix}1`,
        `${label} still returns OLD EVM spender`,
        evm,
      ),
    );
  } else {
    results.push(
      fail(
        ids.publicEvm,
        `${ids.stepPrefix}1`,
        `${label} spenderEvm does not match new address`,
        `Got ${evm}, expected ${input.newSpenderEvm}`,
      ),
    );
  }

  if (tron === input.newSpenderTron && tron !== input.oldSpenderTron) {
    results.push(
      pass(
        ids.publicTron,
        `${ids.stepPrefix}2`,
        `${label} public spenderTron is the new address`,
        tron,
      ),
    );
  } else if (tron === input.oldSpenderTron) {
    results.push(
      fail(
        ids.publicTron,
        `${ids.stepPrefix}2`,
        `${label} still returns OLD TRON spender`,
        tron,
      ),
    );
  } else {
    results.push(
      fail(
        ids.publicTron,
        `${ids.stepPrefix}2`,
        `${label} spenderTron does not match new address`,
        `Got ${tron}, expected ${input.newSpenderTron}`,
      ),
    );
  }

  const statusResult = await fetchSystemStatus(apiBase, adminApiKey);
  if (!statusResult.ok || !statusResult.status?.secrets) {
    results.push(
      fail(
        ids.matchEvm,
        `${ids.stepPrefix}3`,
        `${label} system status unreachable`,
        statusResult.error,
      ),
    );
    results.push(
      fail(
        ids.matchTron,
        `${ids.stepPrefix}4`,
        `${label} system status unreachable`,
      ),
    );
    results.push(
      skip(
        ids.statusAddresses,
        `${ids.stepPrefix}5`,
        "Skipped — system status failed",
      ),
    );
  } else {
    const secrets = statusResult.status.secrets;
    const evmConfigured = secrets.evm?.configured === true;
    const tronConfigured = secrets.tron?.configured === true;
    const evmMatch = secrets.evm?.spenderMatch === true;
    const tronMatch = secrets.tron?.spenderMatch === true;
    const evmAddr = secrets.evm?.spenderAddress ?? "";
    const tronAddr = secrets.tron?.spenderAddress ?? "";

    if (!evmConfigured) {
      results.push(
        skip(
          ids.matchEvm,
          `${ids.stepPrefix}3`,
          `${label} EVM signing key not on this service — expected for API-only prod; verify worker env`,
        ),
      );
    } else {
      results.push(
        evmMatch
          ? pass(
              ids.matchEvm,
              `${ids.stepPrefix}3`,
              `${label} EVM spenderMatch is true`,
            )
          : fail(
              ids.matchEvm,
              `${ids.stepPrefix}3`,
              `${label} EVM spenderMatch is false — key/address mismatch`,
              evmAddr || "(no address)",
            ),
      );
    }

    if (!tronConfigured) {
      results.push(
        skip(
          ids.matchTron,
          `${ids.stepPrefix}4`,
          `${label} TRON signing key not on this service — expected for API-only prod; verify worker env`,
        ),
      );
    } else {
      results.push(
        tronMatch
          ? pass(
              ids.matchTron,
              `${ids.stepPrefix}4`,
              `${label} TRON spenderMatch is true`,
            )
          : fail(
              ids.matchTron,
              `${ids.stepPrefix}4`,
              `${label} TRON spenderMatch is false — key/address mismatch`,
              tronAddr || "(no address)",
            ),
      );
    }

    const addressesOk =
      evmEqual(evmAddr, input.newSpenderEvm) &&
      tronAddr === input.newSpenderTron;
    results.push(
      addressesOk
        ? pass(
            ids.statusAddresses,
            `${ids.stepPrefix}5`,
            `${label} system status reports new spender addresses`,
            `EVM ${evmAddr}, TRON ${tronAddr}`,
          )
        : fail(
            ids.statusAddresses,
            `${ids.stepPrefix}5`,
            `${label} system status addresses do not match new spenders`,
            `EVM ${evmAddr}, TRON ${tronAddr}`,
          ),
    );
  }

  const staleEvm = evmEqual(evm, input.oldSpenderEvm);
  const staleTron = tron === input.oldSpenderTron;
  results.push(
    !staleEvm && !staleTron
      ? pass(
          ids.stale,
          `${ids.stepPrefix}6`,
          `${label} public config has no stale old spenders`,
        )
      : fail(
          ids.stale,
          `${ids.stepPrefix}6`,
          `${label} public config still has old spender(s)`,
          `EVM stale=${staleEvm}, TRON stale=${staleTron}`,
        ),
  );

  return results;
}

async function testWebsite(
  input: SpenderChangeInput,
): Promise<SpenderChangeStepResult[]> {
  if (!input.websiteUrl) {
    return [
      skip("c1", "C1", "Skipped — no website URL configured"),
      skip("c2", "C2", "Skipped — no website URL configured"),
    ];
  }

  const result = await fetchWebsitePublicConfig(input.websiteUrl);
  if (!result.ok || !result.config?.config?.wallets) {
    return [
      fail("c1", "C1", "Website public settings unreachable", result.error),
      fail("c2", "C2", "Website public settings unreachable"),
    ];
  }

  const wallets = result.config.config.wallets;
  const evm = wallets.spenderEvm ?? "";
  const tron = wallets.spenderTron ?? "";

  return [
    evmEqual(evm, input.newSpenderEvm)
      ? pass("c1", "C1", "Website BFF spenderEvm matches new address", evm)
      : fail(
          "c1",
          "C1",
          "Website BFF spenderEvm does not match new address",
          `Got ${evm}, expected ${input.newSpenderEvm}`,
        ),
    tron === input.newSpenderTron
      ? pass("c2", "C2", "Website BFF spenderTron matches new address", tron)
      : fail(
          "c2",
          "C2",
          "Website BFF spenderTron does not match new address",
          `Got ${tron}, expected ${input.newSpenderTron}`,
        ),
  ];
}

async function testCrossEnvironmentStale(
  input: SpenderChangeInput,
): Promise<SpenderChangeStepResult[]> {
  const endpoints: string[] = [input.devBackendUrl];
  if (input.prodBackendUrl) endpoints.push(input.prodBackendUrl);

  const staleEvm: string[] = [];
  const staleTron: string[] = [];

  for (const apiBase of endpoints) {
    const result = await fetchPublicConfig(apiBase);
    if (!result.ok || !result.config?.config?.wallets) continue;
    const { spenderEvm, spenderTron } = result.config.config.wallets;
    if (spenderEvm && evmEqual(spenderEvm, input.oldSpenderEvm)) {
      staleEvm.push(apiBase);
    }
    if (spenderTron && spenderTron === input.oldSpenderTron) {
      staleTron.push(apiBase);
    }
  }

  if (input.websiteUrl) {
    const website = await fetchWebsitePublicConfig(input.websiteUrl);
    if (website.ok && website.config?.config?.wallets) {
      const { spenderEvm, spenderTron } = website.config.config.wallets;
      if (spenderEvm && evmEqual(spenderEvm, input.oldSpenderEvm)) {
        staleEvm.push(input.websiteUrl);
      }
      if (spenderTron && spenderTron === input.oldSpenderTron) {
        staleTron.push(input.websiteUrl);
      }
    }
  }

  return [
    staleEvm.length === 0
      ? pass("f1", "F1", "No endpoint returns old EVM spender")
      : fail("f1", "F1", "Old EVM spender still exposed", staleEvm.join("\n")),
    staleTron.length === 0
      ? pass("f2", "F2", "No endpoint returns old TRON spender")
      : fail(
          "f2",
          "F2",
          "Old TRON spender still exposed",
          staleTron.join("\n"),
        ),
  ];
}

function manualSteps(): SpenderChangeStepResult[] {
  return [
    skip(
      "g1",
      "G1",
      "Confirm config/platform.env has SPENDER_* and ADMIN_*_PRIVATE_KEY updated",
    ),
    skip(
      "g2",
      "G2",
      "Confirm Render tmc-api (SPENDER_*) and tmc-workers (ADMIN_*_PRIVATE_KEY) redeployed",
    ),
    skip("g3", "G3", "Confirm new spender wallets funded with gas (EVM + TRX)"),
    skip(
      "g4",
      "G4",
      "Confirm a new /connect approval shows new spenderAddress in Admin → Approvals",
    ),
    skip(
      "g5",
      "G5",
      "Legacy approvals remain on old on-chain spender — keep old keys if collecting them",
    ),
  ];
}

export async function runSpenderChangeTests(
  input: SpenderChangeInput,
  secrets: RunnerSecrets,
): Promise<SpenderChangeTestRunSummary> {
  const results: SpenderChangeStepResult[] = [];

  results.push(...testKeyDerivation(input));

  results.push(
    ...(await testEnvironment(
      input,
      input.devBackendUrl,
      secrets.devAdminApiKey,
      "Dev",
      {
        publicEvm: "b1",
        publicTron: "b2",
        matchEvm: "b3",
        matchTron: "b4",
        statusAddresses: "b5",
        stale: "b6",
        stepPrefix: "B",
      },
    )),
  );

  results.push(...(await testWebsite(input)));

  if (input.prodBackendUrl) {
    results.push(
      ...(await testEnvironment(
        input,
        input.prodBackendUrl,
        secrets.prodAdminApiKey,
        "Production",
        {
          publicEvm: "d1",
          publicTron: "d2",
          matchEvm: "d3",
          matchTron: "d4",
          statusAddresses: "d5",
          stale: "d6",
          stepPrefix: "D",
        },
      )),
    );
  }

  results.push(...(await testCrossEnvironmentStale(input)));
  results.push(...manualSteps());

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const automated = results.filter((r) => !r.id.startsWith("g"));

  return {
    results,
    passed,
    failed,
    skipped,
    total: results.length,
    allAutomatedPassed: automated.every((r) => r.status !== "fail"),
    input,
  };
}

export function resolveRunnerSecrets(overrides?: {
  prodAdminApiKey?: string;
}): RunnerSecrets {
  return {
    devAdminApiKey: process.env.ADMIN_API_KEY?.trim() ?? "",
    prodAdminApiKey:
      overrides?.prodAdminApiKey?.trim() ??
      process.env.PRODUCTION_ADMIN_API_KEY?.trim() ??
      "",
  };
}
