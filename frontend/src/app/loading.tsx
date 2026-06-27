// Route-level loading state (Next.js App Router). Shows instantly during
// navigation / server work so the app feels responsive instead of frozen.
export default function Loading() {
  return (
    <div className="min-h-[72vh] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12 flex items-center justify-center">
          {/* Spinning accent ring */}
          <span
            className="absolute inset-0 rounded-full animate-spin"
            style={{ border: "2px solid var(--border)", borderTopColor: "#FF0040", animationDuration: "0.7s" }}
            aria-hidden="true"
          />
          {/* Vezo chevron mark */}
          <svg width="22" height="16" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="8,4 54,4 70,88 24,88" fill="#FF0040" />
            <polygon points="36,4 54,4 62,38 44,38" fill="var(--bg)" />
            <polygon points="132,4 86,4 70,88 116,88" fill="#FF0040" />
            <polygon points="104,4 86,4 78,38 96,38" fill="var(--bg)" />
          </svg>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-3)" }}>
          Loading
        </span>
      </div>
    </div>
  );
}
