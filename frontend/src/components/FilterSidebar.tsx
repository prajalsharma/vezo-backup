"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Filter, X, ChevronDown, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface FilterSidebarProps {
  collectionFilter: "all" | "veBTC" | "veMEZO";
  setCollectionFilter: (filter: "all" | "veBTC" | "veMEZO") => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  showExpired: boolean;
  setShowExpired: (show: boolean) => void;
  minDiscount: number;
  setMinDiscount: (discount: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function FilterSidebar({
  collectionFilter,
  setCollectionFilter,
  sortBy,
  setSortBy,
  showExpired,
  setShowExpired,
  minDiscount,
  setMinDiscount,
  isOpen,
  onClose,
}: FilterSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-mezo-background/80 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-mezo-card border-l border-mezo-border z-[70] p-8 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-mezo-primary" />
                <h3 className="text-xl font-bold">Market Filters</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-12">
              {/* Collection Section */}
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-mezo-muted mb-6">Asset Type</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'all', label: 'All Collections' },
                    { id: 'veBTC', label: 'veBTC (Bitcoin)' },
                    { id: 'veMEZO', label: 'veMEZO (Governance)' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCollectionFilter(item.id as any)}
                      className={`flex items-center justify-between px-4 py-4 rounded-2xl border transition-all text-sm font-bold
                        ${collectionFilter === item.id 
                          ? 'bg-mezo-primary/10 border-mezo-primary text-white shadow-[0_0_20px_rgba(247,147,26,0.1)]' 
                          : 'bg-white/5 border-transparent text-mezo-muted hover:border-white/10 hover:text-white'
                        }`}
                    >
                      {item.label}
                      {collectionFilter === item.id && <CheckCircle2 className="w-4 h-4 text-mezo-primary" />}
                    </button>
                  ))}
                </div>
              </section>

              {/* Discount Section */}
              <section>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-mezo-muted">Min. Discount</h4>
                  <span className="text-sm font-bold text-mezo-primary">{minDiscount}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={minDiscount}
                  onChange={(e) => setMinDiscount(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-mezo-border rounded-full appearance-none cursor-pointer accent-mezo-primary"
                />
                <div className="flex justify-between mt-2 text-[10px] font-bold text-mezo-muted">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </section>

              {/* Options Section */}
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-mezo-muted mb-6">Market Options</h4>
                <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-transparent hover:border-white/10 transition-all cursor-pointer">
                  <span className="text-sm font-bold">Active Listings Only</span>
                  <input
                    type="checkbox"
                    checked={showExpired}
                    onChange={(e) => setShowExpired(e.target.checked)}
                    className="w-5 h-5 accent-mezo-primary rounded-lg"
                  />
                </label>
              </section>
            </div>

            <div className="mt-20 pt-8 border-t border-mezo-border flex flex-col gap-3">
              <button 
                onClick={onClose}
                className="btn-primary w-full"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setCollectionFilter("all");
                  setMinDiscount(0);
                  setShowExpired(true); // true = show active only (default)
                }}
                className="w-full py-4 text-sm font-bold text-mezo-muted hover:text-white transition-colors"
              >
                Reset to Default
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
      className="flex items-center gap-2 px-6 py-4 bg-mezo-card border border-mezo-border rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
    >
      <Filter className="w-4 h-4" />
      Filters
      {activeFilters > 0 && (
        <span className="w-5 h-5 rounded-full bg-mezo-primary text-black text-[10px] font-black flex items-center justify-center">
          {activeFilters}
        </span>
      )}
    </button>
  );
}
