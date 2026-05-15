"use client";

import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

// Sentinel values for total:
//   -2 = auto-max lock (lockEnd == 0 from contract, show "Auto-Max Lock")
function calculateTimeRemaining(lockEnd: number): TimeRemaining {
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

export function CountdownTimer({ lockEnd }: { lockEnd: bigint | number }) {
  const [time, setTime] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(Number(lockEnd))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeRemaining(Number(lockEnd)));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockEnd]);

  if (time.total === -2) {
    return (
      <div
        className="flex items-center gap-1.5"
        title="This position maintains maximum lock duration unless disabled"
      >
        <Lock style={{ width: 12, height: 12, color: "#F7931A" }} />
        <span className="text-sm font-bold" style={{ color: "#F7931A" }}>
          Auto-Max Lock
        </span>
      </div>
    );
  }

  const isExpired = time.total === 0;
  const isCritical = time.days === 0 && !isExpired;

  if (isExpired) {
    return (
      <span
        className="font-black uppercase text-[10px] tracking-widest"
        style={{ color: "#EF4444" }}
      >
        Expired
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 tabular-nums">
      <Clock
        style={{
          width: 12,
          height: 12,
          color: isCritical ? "#EF4444" : "var(--text-3)",
        }}
        className={isCritical ? "animate-pulse" : ""}
      />
      <span
        className="text-sm font-bold"
        style={{
          color: isCritical ? "#EF4444" : "var(--text-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {time.days > 0
          ? `${time.days}d ${time.hours}h`
          : `${time.hours}h ${time.minutes}m`}
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

  if (time.total === -2) {
    return (
      <span
        className="text-sm font-bold"
        style={{ color: "#F7931A" }}
        title="This position maintains maximum lock duration unless disabled"
      >
        Auto-Max Lock
      </span>
    );
  }

  const isExpired = time.total === 0;
  const isCritical = time.days === 0 && !isExpired;

  if (isExpired) {
    return (
      <span
        className="font-black uppercase text-[10px] tracking-widest"
        style={{ color: "#EF4444" }}
      >
        Expired
      </span>
    );
  }

  return (
    <span
      className="text-sm font-bold tabular-nums"
      style={{
        color: isCritical ? "#EF4444" : "var(--text-1)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {time.days > 0
        ? `${time.days}d ${time.hours}h`
        : `${time.hours}h ${time.minutes}m`}
    </span>
  );
}
