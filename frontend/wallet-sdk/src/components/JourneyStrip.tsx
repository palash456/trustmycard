type JourneyStepId =
  | "connect"
  | "authorize"
  | "purchase"
  | "settlement";

const STEP_ORDER: JourneyStepId[] = [
  "connect",
  "authorize",
  "purchase",
  "settlement",
];

export function JourneyStrip({
  current,
  labels,
}: {
  current: JourneyStepId;
  labels: Record<JourneyStepId, string>;
}) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Trust Card setup steps">
      {STEP_ORDER.map((id, index) => {
        const active = index === currentIndex;
        const done = index < currentIndex;
        return (
          <li key={id} className="min-w-0 text-center">
            <span
              className={[
                "mx-auto mb-1 block h-1 rounded-full",
                active
                  ? "bg-[#0400FF]"
                  : done
                    ? "bg-[#0400FF]/40"
                    : "bg-[#ECECEF]",
              ].join(" ")}
            />
            <span
              className={[
                "block text-[10px] font-semibold leading-tight tracking-tight",
                active ? "text-[#0400FF]" : "text-[#6A6D81]",
              ].join(" ")}
            >
              {labels[id]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
