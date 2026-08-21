export type MigrationTestRunSummary = {
  allAutomatedPassed: boolean;
};

export type MigrationTestModalProps = {
  open: boolean;
  onClose: () => void;
  initialSummary: MigrationTestRunSummary | null;
  resetKey: number;
  onRunStart: () => void;
  onRunStop: () => void;
  onComplete: (summary: MigrationTestRunSummary, durationMs: number) => void;
};

export function DomainMigrationTestSuite() {
  return null;
}

export function MigrationTestModal(_props: MigrationTestModalProps) {
  return null;
}
