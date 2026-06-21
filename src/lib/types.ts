export type PipelineStatus = "active" | "paused" | "failed" | "completed";
export type RunStatus = "success" | "failed" | "running" | "queued" | "cancelled";
export type ETLType = "batch" | "streaming" | "scheduled" | "event-driven";
export type ConnectorType = "postgres" | "mysql" | "bigquery" | "s3" | "kafka" | "redis" | "api" | "mongodb";
export type ConnectorHealth = "healthy" | "degraded" | "down" | "unknown";
export type QualityStatus = "pass" | "warn" | "fail" | "pending";
export type FreshnessStatus = "fresh" | "stale" | "unknown";
export type PipelineErrorCategory =
  | "schema_violation"
  | "null_violation"
  | "timeout"
  | "duplicate"
  | "connector_error";

export interface DataSource {
  id: string;
  name: string;
  connectorType: ConnectorType;
  health: ConnectorHealth;
  recordsProcessed: number;
  lastSync: string;
  latencyMs: number;
}

export interface DataQualityCheck {
  id: string;
  pipelineId: string;
  name: string;
  description: string;
  status: QualityStatus;
  score: number;
  threshold: number;
  lastRun: string;
}

export interface DataFreshness {
  id: string;
  pipelineId: string;
  expectedMaxAgeMinutes: number;
  actualAgeMinutes: number | null;
  status: FreshnessStatus;
  lastChecked: string;
  nextCheckDue: string;
  businessImpact: string;
}

export interface ErrorBreakdown {
  schemaViolations: number;
  nullViolations: number;
  timeouts: number;
  duplicates: number;
  connectorErrors: number;
}

export interface RunErrorBreakdown extends ErrorBreakdown {
  runId: string;
  primaryCategory: PipelineErrorCategory;
  remediationHint: string;
}

export interface ETLJob {
  id: string;
  pipelineId: string;
  name: string;
  etlType: ETLType;
  sourceId: string;
  destinationId: string;
  schedule?: string;
  lastRun: string;
  nextRun?: string;
  avgDurationMs: number;
  enabled: boolean;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: RunStatus;
  startTime: string;
  endTime?: string;
  recordsIngested: number;
  recordsOutput: number;
  errors: number;
  durationMs: number;
  throughputRps: number;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  status: PipelineStatus;
  etlType: ETLType;
  sources: DataSource[];
  upstreamPipelineIds: string[];
  qualityChecks: DataQualityCheck[];
  jobs: ETLJob[];
  runs: PipelineRun[];
  uptimePercent: number;
  avgLatencyMs: number;
  totalRecordsProcessed: number;
  createdAt: string;
  updatedAt: string;
}

export interface QualityBreakdown {
  pass: number;
  warn: number;
  fail: number;
  pending: number;
}

export interface DataMetrics {
  totalPipelines: number;
  activePipelines: number;
  totalRunsToday: number;
  overallQualityScore: number;
  totalThroughputRps: number;
  failedRunsToday: number;
  avgLatencyMs: number;
  uptimePercent: number;
  qualityChecksByStatus: QualityBreakdown;
  errorRatePercent: number;
  errorBreakdownByCategory: ErrorBreakdown;
}
