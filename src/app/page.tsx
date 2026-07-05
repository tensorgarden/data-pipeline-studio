"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import {
  pipelines,
  pipelineRuns,
  sourceConnectors,
  etlJobs,
  schemaDriftEvents,
  observabilityAlerts,
  computeMetrics,
} from "@/lib/demo-data";
import {
  StatusDot,
  Badge,
  Card,
  ProgressBar,
  StatCard,
} from "@/components/ui";
import type { ErrorBreakdown, Pipeline } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────
function statusVariant(
  s: string
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (s) {
    case "active":
    case "success":
    case "pass":
    case "healthy":
      return "success";
    case "paused":
    case "running":
    case "queued":
    case "warn":
    case "degraded":
      return "warning";
    case "failed":
    case "fail":
    case "down":
      return "danger";
    case "completed":
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatUtcDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(5, 16).replace("T", " ");
}

// ── Pipeline Row ───────────────────────────────────────────────────────────
function PipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const lastRun = pipeline.runs[0];

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <StatusDot status={pipeline.status} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {pipeline.name}
            </h3>
            <Badge variant={pipeline.status === "active" ? "success" : pipeline.status === "failed" ? "danger" : pipeline.status === "paused" ? "warning" : "neutral"}>
              {pipeline.status}
            </Badge>
            <Badge variant="info">{pipeline.etlType}</Badge>
            {pipeline.upstreamPipelineIds.length > 0 && (
              <span className="text-xs text-slate-400" title={`Upstream: ${pipeline.upstreamPipelineIds.join(", ")}`}>
                ↑{pipeline.upstreamPipelineIds.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {pipeline.description}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="text-center">
          <p className="font-mono text-sm font-semibold text-slate-900">
            {formatNumber(lastRun?.throughputRps ?? 0)}
          </p>
          <p>records/s</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-sm font-semibold text-slate-900">
            {pipeline.avgLatencyMs}ms
          </p>
          <p>latency</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-sm font-semibold text-slate-900">
            {pipeline.uptimePercent}%
          </p>
          <p>uptime</p>
        </div>
        <div>
          <ProgressBar
            value={pipeline.qualityChecks.filter((q) => q.status === "pass").length}
            max={pipeline.qualityChecks.length}
            showValue
            label="Quality"
            variant={
              pipeline.qualityChecks.some((q) => q.status === "fail")
                ? "danger"
                : pipeline.qualityChecks.some((q) => q.status === "warn")
                  ? "warning"
                  : "success"
            }
          />
        </div>
      </div>
    </Card>
  );
}

// ── Run Timeline ───────────────────────────────────────────────────────────
function RunTimeline() {
  const recent = [...pipelineRuns]
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )
    .slice(0, 10);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-900">
        Recent Pipeline Runs
      </h2>
      <div className="space-y-3">
        {recent.map((run) => {
          const pipe = pipelines.find((p) => p.id === run.pipelineId);
          const v = run.status === "success" ? "success" : run.status === "failed" ? "danger" : run.status === "running" ? "info" : "neutral";
          return (
            <div
              key={run.id}
              className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={run.status} />
                <span className="font-medium text-slate-700">
                  {pipe?.name ?? run.pipelineId}
                </span>
                <Badge variant={v}>{run.status}</Badge>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span>{formatNumber(run.recordsIngested)} rec</span>
                <span>{formatDuration(run.durationMs)}</span>
                <span>{timeAgo(run.startTime)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Quality Dashboard ──────────────────────────────────────────────────────
function QualityDashboard({
  pass,
  warn,
  fail,
  errorRatePercent,
  errorBreakdown,
}: {
  pass: number;
  warn: number;
  fail: number;
  errorRatePercent: number;
  errorBreakdown: ErrorBreakdown;
}) {
  const allChecks = pipelines.flatMap((p) => p.qualityChecks);
  const avgScore =
    allChecks.length > 0
      ? Math.round(
          (allChecks.reduce((s, q) => s + q.score, 0) / allChecks.length) * 10
        ) / 10
      : 0;
  const errorCategories = [
    { label: "Schema", value: errorBreakdown.schemaViolations },
    { label: "Nulls", value: errorBreakdown.nullViolations },
    { label: "Timeouts", value: errorBreakdown.timeouts },
    { label: "Duplicates", value: errorBreakdown.duplicates },
    { label: "Connector", value: errorBreakdown.connectorErrors },
  ].filter((category) => category.value > 0);
  const activeDriftEvents = schemaDriftEvents.filter(
    (event) => event.status !== "resolved"
  );

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-900">
        Data Quality Dashboard
      </h2>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{pass}</p>
          <p className="text-xs text-emerald-600">Passed</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{warn}</p>
          <p className="text-xs text-amber-600">Warnings</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{fail}</p>
          <p className="text-xs text-red-600">Failed</p>
        </div>
      </div>
      <div className="mb-3">
        <ProgressBar
          value={avgScore}
          max={100}
          label={`Overall Quality Score: ${avgScore}%`}
          showValue
          variant={avgScore >= 90 ? "success" : avgScore >= 75 ? "warning" : "danger"}
        />
      </div>
      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-center">
        <p className="text-xs text-slate-500">Today&apos;s Error Rate</p>
        <p
          className={clsx(
            "text-lg font-bold",
            errorRatePercent < 1
              ? "text-emerald-600"
              : errorRatePercent < 5
                ? "text-amber-600"
                : "text-red-600"
          )}
        >
          {errorRatePercent}%
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-slate-100 p-3">
        <p className="mb-2 text-xs font-medium text-slate-600">
          Error triage mix
        </p>
        <div className="space-y-1">
          {errorCategories.map((category) => (
            <div
              key={category.label}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-slate-500">{category.label}</span>
              <span className="font-mono font-semibold text-slate-700">
                {category.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-amber-800">
            Schema drift watch
          </p>
          <span className="text-xs text-amber-700">
            {activeDriftEvents.length} active
          </span>
        </div>
        <div className="space-y-2">
          {activeDriftEvents.map((event) => {
            const pipe = pipelines.find((p) => p.id === event.pipelineId);
            const downstreamNames = event.downstreamPipelineIds
              .map((id) => pipelines.find((p) => p.id === id)?.name ?? id)
              .join(", ");

            return (
              <div
                key={event.id}
                className="rounded-md bg-white/70 p-2 text-xs"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">
                    {pipe?.name ?? event.pipelineId}
                  </span>
                  <Badge
                    variant={
                      event.severity === "breaking"
                        ? "danger"
                        : event.severity === "warning"
                          ? "warning"
                          : "info"
                    }
                  >
                    {event.severity}
                  </Badge>
                </div>
                <p className="text-slate-500">
                  {event.fieldName} · {event.changeType.replace("_", " ")} · {timeAgo(event.detectedAt)}
                </p>
                <p className="mt-1 text-amber-700">
                  Downstream: {downstreamNames || "none"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        {allChecks.map((check) => (
          <div
            key={check.id}
            className="flex items-center justify-between border-b border-slate-50 pb-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <StatusDot status={check.status} />
              <span className="font-medium text-slate-700">{check.name}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span
                className={clsx(
                  "font-mono font-semibold",
                  check.score >= 90
                    ? "text-emerald-600"
                    : check.score >= 75
                      ? "text-amber-600"
                      : "text-red-600"
                )}
              >
                {check.score}%
              </span>
              <span>/ {check.threshold}%</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── ETL Job Scheduler ──────────────────────────────────────────────────────
function ETLScheduler() {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-900">
        ETL Job Scheduler
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-3 font-medium">Job</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">Schedule</th>
              <th className="pb-2 pr-3 font-medium">Last Run</th>
              <th className="pb-2 pr-3 font-medium">Next Run</th>
              <th className="pb-2 pr-3 font-medium">Avg Duration</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {etlJobs.map((job) => {
              const pipe = pipelines.find((p) => p.id === job.pipelineId);
              return (
                <tr key={job.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-700">
                    {job.name}
                    <div className="text-slate-400">{pipe?.name}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="info">{job.etlType}</Badge>
                  </td>
                  <td className="py-2 pr-3 font-mono text-slate-500">
                    {job.schedule ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">
                    {timeAgo(job.lastRun)}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">
                    {job.nextRun ? timeAgo(job.nextRun) : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-slate-500">
                    {job.avgDurationMs > 0
                      ? formatDuration(job.avgDurationMs)
                      : "continuous"}
                  </td>
                  <td className="py-2">
                    <Badge variant={job.enabled ? "success" : "neutral"}>
                      {job.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Source Connector Health ────────────────────────────────────────────────
function SourceHealth() {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-900">
        Source Connector Health
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sourceConnectors.map((src) => (
          <div
            key={src.id}
            className="rounded-lg border border-slate-100 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StatusDot status={src.health} />
                <span className="text-xs font-medium text-slate-700">
                  {src.name}
                </span>
              </div>
              <Badge variant={statusVariant(src.health)}>{src.health}</Badge>
            </div>
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Records</span>
                <span className="font-mono">{formatNumber(src.recordsProcessed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Latency</span>
                <span className="font-mono">
                  {src.latencyMs >= 0 ? `${src.latencyMs}ms` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Sync</span>
                <span>{timeAgo(src.lastSync)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Alert Panel ────────────────────────────────────────────────────────────
function AlertPanel() {
  const priorityRank = {
    page_on_call: 0,
    same_day_review: 1,
    watch: 2,
  } as const;
  const contextAlerts = [...observabilityAlerts].sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority]
  );
  const failedRuns = pipelineRuns.filter((r) => r.status === "failed");
  const failedPipelines = pipelines.filter((p) => p.status === "failed");
  const degradedSources = sourceConnectors.filter(
    (s) => s.health === "degraded" || s.health === "down"
  );

  const hasAlerts =
    contextAlerts.length > 0 ||
    failedRuns.length > 0 ||
    failedPipelines.length > 0 ||
    degradedSources.length > 0;

  if (!hasAlerts) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <StatusDot status="success" />
          <span className="text-sm font-medium text-slate-700">
            All systems operational
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <h2 className="text-sm font-semibold text-amber-900">
          Alerts Requiring Attention
        </h2>
      </div>
      <div className="space-y-2 text-xs">
        {contextAlerts.map((alert) => {
          const pipe = pipelines.find((p) => p.id === alert.pipelineId);
          const variant =
            alert.severity === "critical"
              ? "danger"
              : alert.severity === "warning"
                ? "warning"
                : "info";

          return (
            <div key={alert.id} className="rounded bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusDot
                    status={alert.severity === "critical" ? "failed" : "warn"}
                  />
                  <span className="font-medium text-amber-900">
                    {alert.title}
                  </span>
                </div>
                <Badge variant={variant}>{alert.priority.replaceAll("_", " ")}</Badge>
              </div>
              <p className="text-slate-600">
                {pipe?.name ?? alert.pipelineId} · {alert.affectedAssets.length}
                {" "}
                affected assets · {alert.downstreamPipelineIds.length} downstream
                pipelines
              </p>
              <p className="mt-1 text-slate-500">
                Owner: {alert.response.ownerTeam} · Review due {formatUtcDateTime(alert.response.reviewDueAt)}
                {alert.response.acknowledgedAt
                  ? ` · Acked ${formatUtcDateTime(alert.response.acknowledgedAt)}`
                  : " · Acknowledgement pending"}
              </p>
              <p className="mt-1 text-amber-700">{alert.triageRationale}</p>
              <p className="mt-1 text-slate-500">
                {alert.correlation.rootCauseAlertId
                  ? `Grouped under ${alert.correlation.rootCauseAlertId}`
                  : alert.correlation.suppressedDuplicateCount > 0
                    ? `${alert.correlation.suppressedDuplicateCount} duplicates suppressed`
                    : "No duplicate paging suppressed"}{" "}
                · {alert.correlation.suppressionWindowMinutes}m correlation window
              </p>
            </div>
          );
        })}
        {failedPipelines.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded bg-white p-2"
          >
            <div className="flex items-center gap-2">
              <StatusDot status="failed" />
              <span className="font-medium text-red-700">
                Pipeline failed: {p.name}
              </span>
            </div>
            <Badge variant="danger">failed</Badge>
          </div>
        ))}
        {failedRuns.map((r) => {
          const pipe = pipelines.find((p) => p.id === r.pipelineId);
          return (
            <div
              key={r.id}
              className="flex items-center justify-between rounded bg-white p-2"
            >
              <div className="flex items-center gap-2">
                <StatusDot status="failed" />
                <span className="font-medium text-red-700">
                  Run failed: {pipe?.name ?? r.pipelineId} ({r.errors} errors)
                </span>
              </div>
              <span className="text-red-500">{timeAgo(r.startTime)}</span>
            </div>
          );
        })}
        {degradedSources.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded bg-white p-2"
          >
            <div className="flex items-center gap-2">
              <StatusDot status={s.health} />
              <span className="font-medium text-amber-700">
                {s.health === "down" ? "Source down" : "Source degraded"}:{" "}
                {s.name}
              </span>
            </div>
            <Badge variant={s.health === "down" ? "danger" : "warning"}>
              {s.health}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Page() {
  const metrics = useMemo(() => computeMetrics(), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Data Pipeline Studio
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ETL Automation & Data Quality
        </p>
      </div>

      {/* Alert Panel */}
      <div className="mb-6">
        <AlertPanel />
      </div>

      {/* Hero Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Active Pipelines"
          value={`${metrics.activePipelines}/${metrics.totalPipelines}`}
          subtitle="deployed & running"
          variant="success"
        />
        <StatCard
          label="Runs Today"
          value={metrics.totalRunsToday}
          subtitle={
            metrics.failedRunsToday > 0
              ? `${metrics.failedRunsToday} failed`
              : "all passing"
          }
          variant={metrics.failedRunsToday > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Data Quality Score"
          value={`${metrics.overallQualityScore}%`}
          subtitle="across all checks"
          variant={
            metrics.overallQualityScore >= 90
              ? "success"
              : metrics.overallQualityScore >= 75
                ? "warning"
                : "danger"
          }
        />
        <StatCard
          label="Total Throughput"
          value={`${formatNumber(metrics.totalThroughputRps)}/s`}
          subtitle={`avg ${metrics.avgLatencyMs}ms latency`}
          variant="default"
        />
      </div>

      {/* Pipeline Status Grid */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Pipeline Status
        </h2>
        <div className="space-y-3">
          {pipelines.map((p) => (
            <PipelineRow key={p.id} pipeline={p} />
          ))}
        </div>
      </div>

      {/* Two-column: Run Timeline + Quality Dashboard */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <RunTimeline />
        <QualityDashboard
          pass={metrics.qualityChecksByStatus.pass}
          warn={metrics.qualityChecksByStatus.warn}
          fail={metrics.qualityChecksByStatus.fail}
          errorRatePercent={metrics.errorRatePercent}
          errorBreakdown={metrics.errorBreakdownByCategory}
        />
      </div>

      {/* ETL Scheduler */}
      <div className="mb-8">
        <ETLScheduler />
      </div>

      {/* Source Connector Health */}
      <div className="mb-8">
        <SourceHealth />
      </div>
    </div>
  );
}
