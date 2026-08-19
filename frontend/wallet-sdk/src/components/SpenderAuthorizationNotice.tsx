function truncateAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`;
}

export function SpenderAuthorizationNotice({
  message,
  spender,
}: {
  message: string;
  spender?: string;
}) {
  const spenderLine = spender?.trim()
    ? truncateAddress(spender.trim())
    : null;

  return (
    <div
      className="rounded-2xl border border-[#ECECEF] bg-[#F9FAFB] px-4 py-3 text-left text-xs leading-relaxed text-[#6A6D81]"
      role="note"
    >
      <p>{message}</p>
      {spenderLine ? (
        <p className="mt-2 font-mono text-[11px] text-[#131520]">
          {spenderLine}
        </p>
      ) : null}
    </div>
  );
}
