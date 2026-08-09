type ConnectButtonProps = {
  ready: boolean;
  busy: boolean;
  walletConnected: boolean;
  error: string | null;
  showResults: boolean;
  linkedAddressLabel: string | null;
  onConnect: () => void;
};

const buttonStyle = {
  backgroundColor: "#3396f0",
  color: "#ffffff",
} as const;

const connectedStyle = {
  backgroundColor: "#ecfdf5",
  color: "#047857",
  borderColor: "#6ee7b7",
} as const;

export function ConnectButton({
  ready,
  busy,
  walletConnected,
  error,
  showResults,
  linkedAddressLabel,
  onConnect,
}: ConnectButtonProps) {
  const label = !ready
    ? "Loading…"
    : busy
      ? "Connecting…"
      : walletConnected && !showResults
        ? linkedAddressLabel
          ? `Connected · ${linkedAddressLabel}`
          : "Connected"
        : "Connect Wallet";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={!ready || busy}
        onClick={onConnect}
        style={
          walletConnected && !showResults && !busy
            ? connectedStyle
            : buttonStyle
        }
        className={[
          "rounded-xl px-6 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-80 cursor-pointer",
          walletConnected && !showResults && !busy
            ? "border hover:bg-emerald-100"
            : "hover:enabled:bg-[#2b7fd6]",
        ].join(" ")}
      >
        {label}
      </button>
      {error && !showResults ? (
        <p className="max-w-xs text-center text-sm text- !bg-indigo-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
