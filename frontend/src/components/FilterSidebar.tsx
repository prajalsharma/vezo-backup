"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Filter, X, CheckCircle2, SlidersHorizontal, Star, Clock, TrendingDown, Zap, GitMerge, RefreshCw } from "lucide-react";

export interface FilterState {
  collectionFilter: "all" | "veBTC" | "veMEZO";
  sortBy: string;
  activeOnly: boolean;
  minDiscount: number;
  maxDiscount: number;
  showGrantOnly: boolean;
  showAutoLockOnly: boolean;
  showEndingSoon: boolean;
}

interface FilterSidebarProps extends FilterState {
  setCollectionFilter: (v: "all" | "veBTC" | "veMEZO") => void;
  setSortBy: (v: string) => void;
  setActiveOnly: (v: boolean) => void;
  setMinDiscount: (v: number) => void;
  setMaxDiscount: (v: number) => void;
  setShowGrantOnly: (v: boolean) => void;
  setShowAutoLockOnly: (v: boolean) => void;
  setShowEndingSoon: (v: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-3 px-0.5" style={{ color: "var(--text-3)" }}>{children}</p>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  icon: Icon,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: any;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm font-bold transition-all duration-150"
      style={{
        background: active ? `${accent || "#FF0040"}12` : "var(--bg-2)",
        borderColor: active ? `${accent || "#FF0040"}45` : "var(--border)",
        color: active ? (accent || "#FF0040") : "var(--text-2)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
        }
      }}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      {active && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5.5 rounded-full transition-all duration-200 flex-shrink-0"
      style={{
        background: checked ? "#FF0040" : "var(--bg-4)",
        width: 40,
        height: 22,
      }}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[3px] w-4 h-4 rounded-full bg-white"
        style={{ width: 16, height: 16 }}
      />
    </button>
  );
}

const SORT_OPTIONS = [
  { value: "discount", label: "Highest Discount" },
  { value: "price-asc", label: "Lowest Price" },
  { value: "price-desc", label: "Highest Price" },
  { value: "time-remaining", label: "Expiring Soon" },
  { value: "newest", label: "Newest First" },
];

export function FilterSidebar({
  collectionFilter, setCollectionFilter,
  sortBy, setSortBy,
  activeOnly, setActiveOnly,
  minDiscount, setMinDiscount,
  maxDiscount, setMaxDiscount,
  showGrantOnly, setShowGrantOnly,
  showAutoLockOnly, setShowAutoLockOnly,
  showEndingSoon, setShowEndingSoon,
  isOpen, onClose, onReset,
}: FilterSidebarProps) {

  const activeFilterCount = [
    collectionFilter !== "all",
    minDiscount > 0,
    maxDiscount < 50,
    showGrantOnly,
    showAutoLockOnly,
    showEndingSoon,
  ].filter(Boolean).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-[340px] z-[70] flex flex-col overflow-hidden"
            style={{
              background: "var(--bg-1)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-vezo-red" style={{ color: "#FF0040" }} />
                <h3 className="text-base font-bold">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                    style={{ background: "#FF0040" }}>
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7" style={{ background: "var(--bg-1)" }}>

              {/* ── Asset Type ── */}
              <section>
                <SectionLabel>Asset Type</SectionLabel>
                <div className="space-y-2">
                  {[
                    { id: "all", label: "All Collections" },
                    { id: "veBTC", label: "veBTC", accent: "#F7931A" },
                    { id: "veMEZO", label: "veMEZO", accent: "#4A90E2" },
                  ].map((item) => (
                    <FilterChip
                      key={item.id}
                      label={item.label}
                      active={collectionFilter === item.id}
                      onClick={() => setCollectionFilter(item.id as any)}
                      accent={item.accent}
                    />
                  ))}
                </div>
              </section>

              {/* ── Sort By ── */}
              <section>
                <SectionLabel>Sort By</SectionLabel>
                <div className="space-y-1.5">
                  {SORT_OPTIONS.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={sortBy === opt.value}
                      onClick={() => setSortBy(opt.value)}
                    />
                  ))}
                </div>
              </section>

              {/* ── Discount Range ── */}
              <section>
                <div className="flex justify-between items-center mb-3">
                  <SectionLabel>Discount Range</SectionLabel>
                  <span className="text-xs font-bold" style={{ color: "#FF0040" }}>
                    {minDiscount}% – {maxDiscount}%
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-medium mb-2" style={{ color: "var(--text-3)" }}>
                      <span>Min discount</span>
                      <span className="font-bold" style={{ color: "var(--text-2)" }}>{minDiscount}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      step="5"
                      value={minDiscount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setMinDiscount(v);
                        if (v > maxDiscount) setMaxDiscount(v);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-medium mb-2" style={{ color: "var(--text-3)" }}>
                      <span>Max discount</span>
                      <span className="font-bold" style={{ color: "var(--text-2)" }}>{maxDiscount}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={maxDiscount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setMaxDiscount(v);
                        if (v < minDiscount) setMinDiscount(v);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold" style={{ color: "var(--text-4)" }}>
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>
              </section>

              {/* ── Quick Presets ── */}
              <section>
                <SectionLabel>Quick Presets</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  <FilterChip
                    label="Best Deals"
                    icon={Star}
                    active={minDiscount >= 10}
                    onClick={() => { setMinDiscount(10); setMaxDiscount(50); }}
                    accent="#F59E0B"
                  />
                  <FilterChip
                    label="Ending Soon"
                    icon={Clock}
                    active={showEndingSoon}
                    onClick={() => { setShowEndingSoon(!showEndingSoon); setSortBy("time-remaining"); }}
                    accent="#EF4444"
                  />
                  <FilterChip
                    label="Deep Discount"
                    icon={TrendingDown}
                    active={minDiscount >= 20}
                    onClick={() => { setMinDiscount(20); setMaxDiscount(50); }}
                    accent="#10B981"
                  />
                  <FilterChip
                    label="Grant NFTs"
                    icon={GitMerge}
                    active={showGrantOnly}
                    onClick={() => setShowGrantOnly(!showGrantOnly)}
                    accent="#F59E0B"
                  />
                </div>
              </section>

              {/* ── Toggles ── */}
              <section>
                <SectionLabel>Options</SectionLabel>
                <div className="space-y-3">
                  {[
                    { label: "Active listings only", sub: "Hide sold/cancelled", val: activeOnly, set: setActiveOnly },
                    { label: "Auto max-lock only", sub: "Continuously max-locked positions", val: showAutoLockOnly, set: setShowAutoLockOnly },
                  ].map((toggle) => (
                    <div
                      key={toggle.label}
                      className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
                      style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}
                      onClick={() => toggle.set(!toggle.val)}
                    >
                      <div>
                        <p className="text-sm font-bold">{toggle.label}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>{toggle.sub}</p>
                      </div>
                      <ToggleSwitch checked={toggle.val} onChange={toggle.set} />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer actions */}
            <div className="px-5 py-5 border-t space-y-2" style={{ borderColor: "var(--border)", background: "var(--bg-1)" }}>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-150"
                style={{ background: "linear-gradient(135deg, #FF0040, #CC0030)" }}
              >
                Apply Filters
              </button>
              <button
                onClick={onReset}
                className="w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset All
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function FilterButton({ onClick, activeFilters }: { onClick: () => void; activeFilters: number }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-150"
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        color: "var(--text-2)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
      }}
    >
      <Filter className="w-4 h-4" />
      Filters
      {activeFilters > 0 && (
        <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white"
          style={{ background: "#FF0040" }}>
          {activeFilters}
        </span>
      )}
    </button>
  );
}
