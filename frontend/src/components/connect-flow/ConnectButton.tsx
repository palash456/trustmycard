type ConnectButtonProps = {
  ready: boolean;
  busy: boolean;
  error: string | null;
  showResults: boolean;
  onConnect: () => void;
};

export function ConnectButton({
  ready,
  busy,
  error,
  showResults,
  onConnect,
}: ConnectButtonProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={!ready || busy}
        onClick={onConnect}
        className="rounded-xl bg-[#3396f0] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && !showResults ? (
        <p className="max-w-xs text-center text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
