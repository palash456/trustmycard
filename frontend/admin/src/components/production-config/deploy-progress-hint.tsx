"use client";

import { useEffect, useMemo, useState } from "react";

type DeployEvent = {
  phase: string;
  message?: string;
};

export type DeployProgressPhase =
  | "read"
  | "validation"
  | "preflight"
  | "apply"
  | "restart"
  | "verify"
  | "synchronization"
  | "propagation"
  | "finalize"
  | "complete"
  | "rollback";

export const DEPLOY_PROGRESS_MESSAGES: Record<
  Exclude<DeployProgressPhase, "complete" | "rollback">,
  readonly string[]
> = {
  read: [
    "Loading current production configuration state",
    "Reading deployed values from runtime",
    "Fetching latest configuration snapshot now",
    "Checking existing production settings first",
    "Loading runtime state from disk",
    "Retrieving current live configuration values",
    "Reading previous deployment configuration record",
    "Gathering current field values from production",
    "Loading configuration history for comparison",
    "Accessing production config store now",
  ],
  validation: [
    "Checking new value meets format rules",
    "Validating domain name syntax and structure",
    "Verifying Meta Pixel ID is numeric",
    "Ensuring value differs from current setting",
    "Running input validation rules now",
    "Confirming configuration change is allowed",
    "Validating requested configuration against schema",
    "Checking value length and character constraints",
    "Verifying no invalid characters in input",
    "Cross-checking value against platform requirements",
  ],
  preflight: [
    "Building updated configuration from inputs",
    "Compiling environment variables for services",
    "Merging changes into runtime configuration",
    "Generating new config files for deployment",
    "Preparing service-specific environment updates",
    "Resolving configuration references and dependencies",
    "Building final configuration artifact now",
    "Staging compiled config for application",
    "Finalizing configuration before writing changes",
    "Checking configuration consistency across services",
  ],
  apply: [
    "Writing new values to runtime store",
    "Saving updated configuration to disk",
    "Persisting configuration change to production",
    "Updating runtime state with new value",
    "Committing configuration change to storage",
    "Applying new settings to config files",
    "Writing deployment record for audit trail",
    "Saving configuration snapshot for rollback",
    "Storing updated values in runtime state",
    "Recording change metadata and timestamp",
  ],
  restart: [
    "Restarting affected services with new config",
    "Reloading wallet service with updated settings",
    "Applying configuration without full image rebuild",
    "Docker image rebuild was intentionally skipped",
    "Database migration was intentionally skipped",
    "Restarting backend and wallet containers now",
    "Releasing configuration to running services",
    "Triggering service reload via Docker socket",
    "Rolling out config-only release to production",
    "Services picking up new environment values",
  ],
  verify: [
    "Checking production endpoints respond correctly",
    "Verifying updated value is live publicly",
    "Running health checks against production services",
    "Confirming configuration visible on live website",
    "Testing API returns expected configuration value",
    "Polling services until healthy status confirmed",
    "Validating public-facing settings match new value",
    "Running post-deploy verification checks now",
    "Ensuring no service errors after config change",
    "Confirming deployment succeeded across all checks",
  ],
  synchronization: [
    "Runtime configuration targets identified",
    "Configuration record aligned with production schema",
    "Sync scope determined for live services",
    "Cross-service configuration references resolved",
    "Production state snapshot compared with request",
    "Runtime store mapping confirmed",
    "Configuration dependencies reconciled",
    "Service binding targets listed",
    "Sync checklist completed",
    "Ready for propagation window",
  ],
  propagation: [
    "Distribution paths mapped for live services",
    "Edge cache invalidation window scheduled",
    "Public API exposure paths noted",
    "Website SSR read path registered",
    "Configuration visibility window estimated",
    "Propagation graph validated",
    "Live traffic paths accounted for",
    "Rollout scope confirmed across nodes",
    "Cache refresh cadence aligned",
    "Standing by for verification phase",
  ],
  finalize: [
    "Completion summary prepared",
    "Deployment presentation finalizing",
    "Results being assembled for confirmation",
    "Change record indexed for activity log",
    "Success criteria checklist reviewed",
    "UI transition pending minimum review window",
    "Wrapping up deployment workflow",
    "Preparing success confirmation",
    "Almost ready to confirm completion",
    "Finalizing user-facing status",
  ],
};

export function getDeployProgressPhase(events: DeployEvent[]): DeployProgressPhase {
  const latestMeaningful =
    [...events].reverse().find((event) => event.phase !== "log") ?? events.at(-1);
  const phase = latestMeaningful?.phase ?? "read";

  if (phase === "complete" || phase === "rollback") return phase;
  if (phase in DEPLOY_PROGRESS_MESSAGES) {
    return phase as Exclude<DeployProgressPhase, "complete" | "rollback">;
  }
  return "read";
}

export function DeployProgressHint({
  events,
  busy,
}: {
  events: DeployEvent[];
  busy: boolean;
}) {
  const phase = useMemo(() => getDeployProgressPhase(events), [events]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    setMessageIndex(0);
  }, [phase]);

  useEffect(() => {
    if (!busy || phase === "complete" || phase === "rollback") return;

    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % 10);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [busy, phase]);

  if (!busy) {
    return <p className="mt-4 text-sm text-muted-foreground">Waiting for completion…</p>;
  }

  if (phase === "complete") {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Deployment finished — finalizing results…
      </p>
    );
  }

  if (phase === "rollback") {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Restoring previous configuration after failure…
      </p>
    );
  }

  const messages = DEPLOY_PROGRESS_MESSAGES[phase];

  return (
    <p className="mt-4 text-sm text-muted-foreground transition-opacity duration-300">
      {messages[messageIndex % messages.length]}
    </p>
  );
}
