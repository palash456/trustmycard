function truncateAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`;
}

export function SpenderAuthorizationNotice({
  message,
  spender,
  spenderLabel,
  spenderHelp,
}: {
  message: string;
  spender?: string;
  spenderLabel?: string;
  spenderHelp?: string;
}) {
  const spenderLine = spender?.trim()
    ? truncateAddress(spender.trim())
    : null;

  return (
    <div
      className="rounded-2xl border border-[#ECECEF] bg-[#F9FAFB] px-4 py-3 text-left text-xs leading-relaxed text-[#6A6D81]"
      role="note"
    >
      <p className="font-medium text-[#131520]">{message}</p>
      {spenderLine ? (
        <div className="mt-3 rounded-xl border border-[#ECECEF] bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0400FF]">
            {spenderLabel ?? "Trust Card platform spender"}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-[#131520]">
            {spenderLine}
          </p>
          {spenderHelp ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#6A6D81]">
              {spenderHelp}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
