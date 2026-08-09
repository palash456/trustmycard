export function nivoTheme(isDark: boolean) {
  const text = isDark ? "#e2e8f0" : "#334155";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark
    ? "rgba(255,255,255,0.12)"
    : "rgba(15,23,42,0.1)";

  return {
    background: "transparent",
    text: {
      fill: text,
      fontSize: 12,
      fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
    },
    axis: {
      domain: { line: { stroke: "transparent" } },
      ticks: {
        line: { stroke: "transparent" },
        text: { fill: text, fontSize: 11 },
      },
      legend: { text: { fill: text, fontSize: 12 } },
    },
    grid: {
      line: {
        stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
        strokeWidth: 1,
      },
    },
    tooltip: {
      container: {
        background: tooltipBg,
        color: text,
        fontSize: 12,
        borderRadius: 8,
        boxShadow: isDark
          ? "0 8px 24px rgba(0,0,0,0.45)"
          : "0 8px 24px rgba(15,23,42,0.12)",
        border: `1px solid ${tooltipBorder}`,
        padding: "8px 12px",
      },
    },
  };
}
