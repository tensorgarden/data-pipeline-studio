import { clsx } from "clsx";
import {
  PipelineStatus,
  RunStatus,
  QualityStatus,
  ConnectorHealth,
} from "@/lib/types";

// ── StatusDot ──────────────────────────────────────────────────────────────
export function StatusDot({
  status,
}: {
  status: PipelineStatus | RunStatus | QualityStatus | ConnectorHealth;
}) {
  const map: Record<string, string> = {
    active: "bg-emerald-500",
    paused: "bg-amber-500",
    failed: "bg-red-500",
    completed: "bg-slate-400",
    success: "bg-emerald-500",
    running: "bg-blue-500 animate-pulse",
    queued: "bg-slate-300",
    cancelled: "bg-slate-400",
    pass: "bg-emerald-500",
    warn: "bg-amber-500",
    fail: "bg-red-500",
    pending: "bg-slate-300",
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    down: "bg-red-500",
    unknown: "bg-slate-300",
  };
  return (
    <span
      className={clsx(
        "inline-block h-2.5 w-2.5 rounded-full",
        map[status] ?? "bg-slate-300"
      )}
    />
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const colors: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
    neutral: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[variant]
      )}
    >
      {children}
    </span>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── ProgressBar ────────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  max = 100,
  label,
  showValue,
  variant = "success",
}: {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: "success" | "warning" | "danger" | "info";
}) {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  const barColors: Record<string, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
  };
  return (
    <div>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          {label && <span>{label}</span>}
          {showValue && (
            <span>
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={clsx("h-full rounded-full transition-all", barColors[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  subtitle,
  variant = "default",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const borders: Record<string, string> = {
    default: "border-l-slate-400",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
  };
  const texts: Record<string, string> = {
    default: "text-slate-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  };
  return (
    <div
      className={clsx(
        "rounded-lg border border-slate-200 border-l-4 bg-white p-4",
        borders[variant]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={clsx("mt-1 text-2xl font-bold", texts[variant])}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}
