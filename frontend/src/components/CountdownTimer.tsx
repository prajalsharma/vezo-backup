"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, AlertCircle, Lock } from "lucide-react";

interface CountdownTimerProps {
  lockEnd: bigint | number;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

// Sentinel values for total:
//   -1 = adapter data not yet loaded (show "—")
//   -2 = auto-max lock (lockEnd == 0 from contract, show "Auto-Max Lock")
//        This means the lock is continuously reset to maximum duration.
//        It can be disabled by the holder, after which normal decay begins.
function calculateTimeRemaining(lockEnd: number): TimeRemaining {
  // lockEnd === 0 from the contract means an auto-max lock (not loading).
  // We distinguish "not loaded yet" from "auto-max lock" by checking whether
  // the parent component has received any adapter data. Here we use -2
  // as the auto-max sentinel and rely on the caller to pass 0n only when
  // the adapter has confirmed lockEnd = 0.
  if (lockEnd === 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: -2 };
  }
  const now = Math.floor(Date.now() / 1000);
  const total = Math.max(0, lockEnd - now);

  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    total,
  };
}

export function CountdownTimer({ lockEnd }: CountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(Number(lockEnd))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeRemaining(Number(lockEnd)));
    }, 1000);

    return () => clearInterval(interval);
  }, [lockEnd]);

  // -2 = auto-max lock (lockEnd == 0 confirmed by adapter)
  if (time.total === -2) return (
    <div className="flex items-center gap-1.5" title="This position maintains maximum lock duration unless disabled">
      <Lock className="w-3 h-3 text-mezo-primary" />
      <span className="text-sm font-bold text-mezo-primary">Auto-Max Lock</span>
    </div>
  );

  const isExpired = time.total === 0;
  const isCritical = time.days === 0;

  if (isExpired) return <span className="text-mezo-danger font-black uppercase text-[10px]">Expired</span>;

  return (
    <div className="flex items-center gap-1.5 tabular-nums">
      <Clock className={`w-3 h-3 ${isCritical ? 'text-mezo-danger animate-pulse' : 'text-mezo-muted'}`} />
      <span className={`text-sm font-bold ${isCritical ? 'text-mezo-danger' : 'text-white'}`}>
        {time.days > 0 ? `${time.days}d ${time.hours}h` : `${time.hours}h ${time.minutes}m`}
      </span>
    </div>
  );
}

export function CountdownCompact({ lockEnd }: { lockEnd: bigint | number }) {
  const [time, setTime] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(Number(lockEnd))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeRemaining(Number(lockEnd)));
    }, 1000);

    return () => clearInterval(interval);
  }, [lockEnd]);

  // -2 = auto-max lock (lockEnd == 0 confirmed by adapter)
  if (time.total === -2) return <span className="text-sm font-bold text-mezo-primary" title="This position maintains maximum lock duration unless disabled">Auto-Max Lock</span>;

  const isExpired = time.total === 0;
  const isCritical = time.days === 0;

  if (isExpired) return <span className="text-mezo-danger font-black uppercase text-[10px] tracking-widest">Expired</span>;

  return (
    <span className={`text-sm font-bold tabular-nums ${isCritical ? 'text-mezo-danger' : 'text-white'}`}>
      {time.days > 0 ? `${time.days}d ${time.hours}h` : `${time.hours}h ${time.minutes}m`}
    </span>
  );
}
