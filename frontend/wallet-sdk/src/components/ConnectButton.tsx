type ConnectButtonProps = {
  ready: boolean;
  busy: boolean;
  error: string | null;
  showResults: boolean;
  onConnect: () => void;
};

const buttonStyle = {
  backgroundColor: "#3396f0",
  color: "#ffffff",
} as const;

export function ConnectButton({
  ready,
  busy,
  error,
  showResults,
  onConnect,
}: ConnectButtonProps) {
  const label = !ready ? "Loading…" : busy ? "Connecting…" : "Connect Wallet";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={!ready || busy}
        onClick={onConnect}
        style={buttonStyle}
        className="rounded-xl px-6 py-3.5 text-sm font-semibold transition hover:enabled:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-80 cursor-pointer"
      >
        {label}
      </button>
      {error && !showResults ? (
        <p className="max-w-xs text-center text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
