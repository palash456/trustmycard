export type SpenderChangeTestRunSummary = {
  allAutomatedPassed: boolean;
};

export type SpenderChangeTestModalProps = {
  open: boolean;
  onClose: () => void;
  initialSummary: SpenderChangeTestRunSummary | null;
  resetKey: number;
  onRunStart: () => void;
  onRunStop: () => void;
  onComplete: (summary: SpenderChangeTestRunSummary, durationMs: number) => void;
};

export function SpenderChangeTestSuite() {
  return null;
}

export function SpenderChangeTestModal(_props: SpenderChangeTestModalProps) {
  return null;
}
