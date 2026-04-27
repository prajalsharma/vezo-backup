"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck, X } from "lucide-react";

const DISMISS_KEY = "vezo-security-notice-dismissed";

export function SecurityNoticeBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="sticky top-20 z-40 border-b border-amber-500/20 bg-[#1b1307]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mt-0.5 rounded-xl bg-amber-500/15 p-2 text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Security Update
          </div>
          <p className="mt-2 text-sm leading-6 text-white/90">
            Due to the recent{" "}
            <a
              href="https://vercel.com/kb/bulletin/vercel-april-2026-security-incident"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200"
            >
              Vercel April 2026 security incident
            </a>
            , we rotated keys and redeployed the marketplace as a best-practice
            safety measure to protect users and the protocol. This app is the
            previous deployment. For the latest marketplace experience, use{" "}
            <a
              href="https://vezo.exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200"
            >
              vezo.exchange
            </a>{" "}
            . If you need to manage older listings created here, you can still
            use this previous deployment.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href="https://vezo.exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black transition-colors hover:bg-amber-300"
            >
              Open Latest App
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Continue Securely
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss security notice"
          className="rounded-xl p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
