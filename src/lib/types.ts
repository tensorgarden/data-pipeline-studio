export type PipelineStatus = "active" | "paused" | "failed" | "completed";
export type RunStatus = "success" | "failed" | "running" | "queued" | "cancelled";
export type ETLType = "batch" | "streaming" | "scheduled" | "event-driven";
export type ConnectorType = "postgres" | "mysql" | "bigquery" | "s3" | "kafka" | "redis" | "api" | "mongodb";
export type ConnectorHealth = "healthy" | "degraded" | "down" | "unknown";
export type QualityStatus = "pass" | "warn" | "fail" | "pending";
export type FreshnessStatus = "fresh" | "stale" | "unknown";
export type SchemaDriftChangeType =
  | "column_added"
  | "column_removed"
  | "type_changed"
  | "semantic_change";
export type SchemaDriftSeverity = "info" | "warning" | "breaking";
export type SchemaDriftStatus = "monitoring" | "remediating" | "resolved";
export type PipelineErrorCategory =
  | "schema_violation"
  | "null_violation"
  | "timeout"
  | "duplicate"
  | "connector_error";

export type ObservabilityAlertKind =
  | "freshness_slo"
  | "schema_drift"
  | "volume_anomaly"
  | "connector_health";
export type ObservabilityAlertSeverity = "info" | "warning" | "critical";
export type ObservabilityAlertPriority =
  | "watch"
  | "same_day_review"
  | "page_on_call";
export type BusinessCriticality = "low" | "medium" | "high" | "critical";
export type AffectedAssetType =
  | "dashboard"
  | "feature_store"
  | "report"
  | "notebook"
  | "workspace";
export type PipelineCostSignalStatus = "within_budget" | "watch" | "overrun";
export type RecoveryValidationStatus =
  | "blocked"
  | "validating"
  | "ready_to_publish";
export type ReplayWriteMode = "append" | "upsert" | "partition_overwrite";

export interface AlertCorrelationContext {
  rootCauseAlertId: string | null;
  suppressedDuplicateCount: number;
  suppressionWindowMinutes: number;
  clusterReason: string;
}

export interface AlertResponsePlan {
  ownerTeam: string;
  acknowledgedAt: string | null;
  reviewDueAt: string;
  escalationPolicy: string;
}

export interface AffectedAssetImpact {
  name: string;
  assetType: AffectedAssetType;
  ownerTeam: string;
  impactSummary: string;
}

export interface PipelineCostSignal {
  id: string;
  pipelineId: string;
  windowStart: string;
  windowEnd: string;
  actualSpendUsd: number;
  budgetedSpendUsd: number;
  variancePercent: number;
  status: PipelineCostSignalStatus;
  rootCause: string;
  ownerTeam: string;
  optimizationAction: string;
  nextReviewDueAt: string;
}

export interface PipelineRecoveryValidation {
  id: string;
  pipelineId: string;
  incidentAlertId: string | null;
  replayWindowStart: string;
  replayWindowEnd: string;
  replayRunId: string | null;
  rowCountVariancePercent: number | null;
  qualityChecksPassed: number;
  qualityChecksRequired: number;
  downstreamWatermarkVerified: boolean;
  allowedLatenessMinutes: number;
  lateRecordsDetected: number | null;
  eventTimeWatermarkVerified: boolean;
  lateArrivalEvidence: string;
  replayWriteMode: ReplayWriteMode;
  deduplicationKey: string | null;
  idempotencyVerified: boolean;
  duplicateRowsDetected: number | null;
  idempotencyEvidence: string;
  status: RecoveryValidationStatus;
  ownerTeam: string;
  publishDecisionDueAt: string;
  blockingReason: string | null;
}

export interface ObservabilityAlert {
  id: string;
  pipelineId: string;
  alertKind: ObservabilityAlertKind;
  title: string;
  severity: ObservabilityAlertSeverity;
  businessCriticality: BusinessCriticality;
  triggeredAt: string;
  response: AlertResponsePlan;
  relatedAlertIds: string[];
  correlation: AlertCorrelationContext;
  downstreamPipelineIds: string[];
  affectedAssets: AffectedAssetImpact[];
  priority: ObservabilityAlertPriority;
  triageRationale: string;
  recommendedAction: string;
}

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

export interface SchemaDriftEvent {
  id: string;
  pipelineId: string;
  sourceId: string;
  fieldName: string;
  changeType: SchemaDriftChangeType;
  severity: SchemaDriftSeverity;
  status: SchemaDriftStatus;
  detectedAt: string;
  downstreamPipelineIds: string[];
  remediationPlan: string;
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
