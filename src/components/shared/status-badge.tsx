import * as React from "react";
import { cn, getStatusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = getStatusColor(status);
  const displayLabel = (status || "").replace(/_/g, " ").toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border whitespace-nowrap",
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
      {displayLabel}
    </span>
  );
}
