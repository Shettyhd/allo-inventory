"use client";
import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export function CountdownTimer({ expiresAt, onExpired }: CountdownTimerProps) {
  const [msLeft, setMsLeft] = React.useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );

  React.useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setMsLeft(remaining);
      if (remaining === 0) onExpired?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(msLeft / 60000);
  const secs = Math.floor((msLeft % 60000) / 1000);
  const pct = Math.min(100, (msLeft / (10 * 60 * 1000)) * 100);
  const urgent = msLeft < 120_000; // < 2 min
  const expired = msLeft === 0;

  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3",
      expired ? "border-red-200 bg-red-50" :
      urgent ? "border-amber-200 bg-amber-50" :
      "border-slate-200 bg-slate-50"
    )}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Clock className="h-4 w-4" />
          Reservation expires in
        </span>
        <span className={cn(
          "text-2xl font-bold tabular-nums",
          expired ? "text-red-600" :
          urgent ? "text-amber-600" :
          "text-slate-800"
        )}>
          {expired ? "Expired" : `${mins}:${secs.toString().padStart(2, "0")}`}
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            expired ? "bg-red-500" :
            urgent ? "bg-amber-500" :
            "bg-indigo-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {urgent && !expired && (
        <p className="text-xs text-amber-700 font-medium">
          Hurry! Complete your purchase before the reservation expires.
        </p>
      )}
      {expired && (
        <p className="text-xs text-red-700 font-medium">
          This reservation has expired. The units have been released back to stock.
        </p>
      )}
    </div>
  );
}
