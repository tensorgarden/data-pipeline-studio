import { describe, it, expect } from "vitest";
import {
  pipelines,
  pipelineRuns,
  sourceConnectors,
  dataFreshnessRecords,
  runErrorBreakdowns,
  schemaDriftEvents,
  observabilityAlerts,
  computeMetrics,
} from "@/lib/demo-data";

describe("demo-data: pipelines", () => {
  it("should have exactly 8 pipelines", () => {
    expect(pipelines).toHaveLength(8);
  });

  it("should include ETL, streaming, and batch pipeline types", () => {
    const types = new Set(pipelines.map((p) => p.etlType));
    expect(types.has("batch")).toBe(true);
    expect(types.has("streaming")).toBe(true);
    expect(types.has("scheduled")).toBe(true);
    expect(types.has("event-driven")).toBe(true);
  });

  it("should have at least one active pipeline", () => {
    const active = pipelines.filter((p) => p.status === "active");
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it("should have quality checks for every pipeline", () => {
    for (const p of pipelines) {
      expect(p.qualityChecks.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("demo-data: pipeline runs", () => {
  it("should have exactly 15 pipeline runs", () => {
    expect(pipelineRuns).toHaveLength(15);
  });

  it("should include success, failed, and running statuses", () => {
    const statuses = new Set(pipelineRuns.map((r) => r.status));
    expect(statuses.has("success")).toBe(true);
    expect(statuses.has("failed")).toBe(true);
    expect(statuses.has("running")).toBe(true);
  });

  it("should have valid throughput for completed runs", () => {
    const completed = pipelineRuns.filter(
      (r) => r.status === "success" || r.status === "failed"
    );
    for (const r of completed) {
      expect(r.throughputRps).toBeGreaterThan(0);
      expect(r.durationMs).toBeGreaterThan(0);
    }
  });
});

describe("demo-data: source connectors", () => {
  it("should have 8 source connectors", () => {
    expect(sourceConnectors).toHaveLength(8);
  });

  it("should have at least one degraded or down source", () => {
    const unhealthy = sourceConnectors.filter(
      (s) => s.health === "degraded" || s.health === "down"
    );
    expect(unhealthy.length).toBeGreaterThanOrEqual(1);
  });
});

describe("demo-data: data freshness SLOs", () => {
  const knownPipelineIds = new Set(pipelines.map((p) => p.id));

  it("should track one freshness record per pipeline with valid references", () => {
    const freshnessIds = new Set(dataFreshnessRecords.map((r) => r.id));

    expect(dataFreshnessRecords).toHaveLength(pipelines.length);
    expect(freshnessIds.size).toBe(dataFreshnessRecords.length);

    for (const record of dataFreshnessRecords) {
      expect(knownPipelineIds.has(record.pipelineId)).toBe(true);
      expect(record.expectedMaxAgeMinutes).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(record.lastChecked))).toBe(false);
      expect(Number.isNaN(Date.parse(record.nextCheckDue))).toBe(false);
      expect(record.businessImpact.length).toBeGreaterThan(40);
    }
  });

  it("should classify freshness status against the pipeline's max-age SLO", () => {
    for (const record of dataFreshnessRecords) {
      if (record.status === "fresh") {
        expect(record.actualAgeMinutes).not.toBeNull();
        expect(record.actualAgeMinutes ?? Infinity).toBeLessThanOrEqual(
          record.expectedMaxAgeMinutes
        );
      }

      if (record.status === "stale") {
        expect(record.actualAgeMinutes).not.toBeNull();
        expect(record.actualAgeMinutes ?? 0).toBeGreaterThan(
          record.expectedMaxAgeMinutes
        );
      }

      if (record.status === "unknown") {
        expect(record.actualAgeMinutes).toBeNull();
      }
    }
  });

  it("should surface stale or unknown freshness risk for operations review", () => {
    const riskyRecords = dataFreshnessRecords.filter(
      (record) => record.status === "stale" || record.status === "unknown"
    );

    expect(riskyRecords.length).toBeGreaterThanOrEqual(1);
    expect(riskyRecords.every((record) => record.businessImpact.length > 40)).toBe(
      true
    );
  });
});

describe("demo-data: schema drift impact tracking", () => {
  const pipelineIds = new Set(pipelines.map((p) => p.id));
  const sourceIds = new Set(sourceConnectors.map((s) => s.id));
  const downstreamByPipeline = new Map<string, string[]>();

  for (const pipeline of pipelines) {
    for (const upstreamId of pipeline.upstreamPipelineIds) {
      downstreamByPipeline.set(upstreamId, [
        ...(downstreamByPipeline.get(upstreamId) ?? []),
        pipeline.id,
      ]);
    }
  }

  function hasDownstreamPath(
    startId: string,
    targetId: string,
    visited = new Set<string>()
  ): boolean {
    if (visited.has(startId)) return false;
    visited.add(startId);

    for (const childId of downstreamByPipeline.get(startId) ?? []) {
      if (childId === targetId) return true;
      if (hasDownstreamPath(childId, targetId, visited)) return true;
    }

    return false;
  }

  it("should track schema drift events with valid source and pipeline references", () => {
    const eventIds = new Set(schemaDriftEvents.map((event) => event.id));

    expect(schemaDriftEvents.length).toBeGreaterThanOrEqual(3);
    expect(eventIds.size).toBe(schemaDriftEvents.length);

    for (const event of schemaDriftEvents) {
      expect(pipelineIds.has(event.pipelineId)).toBe(true);
      expect(sourceIds.has(event.sourceId)).toBe(true);
      expect(Number.isNaN(Date.parse(event.detectedAt))).toBe(false);
      expect(event.fieldName.trim().length).toBeGreaterThan(3);
      expect(event.remediationPlan.length).toBeGreaterThan(60);
    }
  });

  it("should map breaking schema drift to downstream impact", () => {
    const breakingEvents = schemaDriftEvents.filter(
      (event) => event.severity === "breaking"
    );

    expect(breakingEvents.length).toBeGreaterThanOrEqual(1);

    for (const event of breakingEvents) {
      expect(event.status).not.toBe("resolved");
      expect(event.downstreamPipelineIds.length).toBeGreaterThanOrEqual(1);

      for (const downstreamId of event.downstreamPipelineIds) {
        expect(pipelineIds.has(downstreamId)).toBe(true);
        expect(hasDownstreamPath(event.pipelineId, downstreamId)).toBe(true);
      }
    }
  });

  it("should distinguish monitoring, remediation, and resolved drift states", () => {
    const statuses = new Set(schemaDriftEvents.map((event) => event.status));
    const severities = new Set(schemaDriftEvents.map((event) => event.severity));

    expect(statuses.has("monitoring")).toBe(true);
    expect(statuses.has("remediating")).toBe(true);
    expect(statuses.has("resolved")).toBe(true);
    expect(severities.has("breaking")).toBe(true);
    expect(severities.has("warning")).toBe(true);
    expect(severities.has("info")).toBe(true);
  });
});

describe("demo-data: run error triage", () => {
  const runsById = new Map(pipelineRuns.map((run) => [run.id, run]));
  const breakdownFields = [
    "schemaViolations",
    "nullViolations",
    "timeouts",
    "duplicates",
    "connectorErrors",
  ] as const;
  const primaryCategoryField = {
    schema_violation: "schemaViolations",
    null_violation: "nullViolations",
    timeout: "timeouts",
    duplicate: "duplicates",
    connector_error: "connectorErrors",
  } as const;

  it("should categorize every run with recorded errors", () => {
    const erroringRuns = pipelineRuns.filter((run) => run.errors > 0);
    const breakdownIds = new Set(runErrorBreakdowns.map((b) => b.runId));

    expect(runErrorBreakdowns).toHaveLength(erroringRuns.length);
    for (const run of erroringRuns) {
      expect(breakdownIds.has(run.id)).toBe(true);
    }

    for (const breakdown of runErrorBreakdowns) {
      const run = runsById.get(breakdown.runId);
      expect(run).toBeDefined();
      expect(run?.errors).toBeGreaterThan(0);
      const categorizedErrors = breakdownFields.reduce(
        (total, field) => total + breakdown[field],
        0
      );
      expect(categorizedErrors).toBe(run?.errors);
      expect(breakdown.remediationHint.length).toBeGreaterThan(60);
    }
  });

  it("should align each primary category with the largest error bucket", () => {
    for (const breakdown of runErrorBreakdowns) {
      const primaryField = primaryCategoryField[breakdown.primaryCategory];
      const primaryValue = breakdown[primaryField];

      for (const field of breakdownFields) {
        expect(primaryValue).toBeGreaterThanOrEqual(breakdown[field]);
      }
    }
  });

  it("should aggregate categorized errors into metrics", () => {
    const metrics = computeMetrics();
    const categorizedTotal = breakdownFields.reduce(
      (total, field) => total + metrics.errorBreakdownByCategory[field],
      0
    );
    const totalRunErrors = pipelineRuns.reduce((total, run) => total + run.errors, 0);

    expect(categorizedTotal).toBe(totalRunErrors);
    expect(metrics.errorBreakdownByCategory.schemaViolations).toBeGreaterThan(0);
    expect(metrics.errorBreakdownByCategory.timeouts).toBeGreaterThan(0);
  });
});



describe("demo-data: context-aware alert triage", () => {
  const pipelineIds = new Set(pipelines.map((p) => p.id));
  const alertIds = new Set(observabilityAlerts.map((alert) => alert.id));
  const downstreamByPipeline = new Map<string, string[]>();

  for (const pipeline of pipelines) {
    for (const upstreamId of pipeline.upstreamPipelineIds) {
      downstreamByPipeline.set(upstreamId, [
        ...(downstreamByPipeline.get(upstreamId) ?? []),
        pipeline.id,
      ]);
    }
  }

  function hasDownstreamPath(
    startId: string,
    targetId: string,
    visited = new Set<string>()
  ): boolean {
    if (visited.has(startId)) return false;
    visited.add(startId);

    for (const childId of downstreamByPipeline.get(startId) ?? []) {
      if (childId === targetId) return true;
      if (hasDownstreamPath(childId, targetId, visited)) return true;
    }

    return false;
  }

  it("should prioritize alerts with valid pipeline references and actionable context", () => {
    expect(observabilityAlerts.length).toBeGreaterThanOrEqual(3);
    expect(alertIds.size).toBe(observabilityAlerts.length);

    for (const alert of observabilityAlerts) {
      expect(pipelineIds.has(alert.pipelineId)).toBe(true);
      expect(Number.isNaN(Date.parse(alert.triggeredAt))).toBe(false);
      expect(alert.affectedAssets.length).toBeGreaterThanOrEqual(1);
      expect(alert.triageRationale.length).toBeGreaterThan(80);
      expect(alert.recommendedAction.length).toBeGreaterThan(80);
    }
  });

  it("should cluster related alerts without invalid or self-referencing IDs", () => {
    const clusteredAlerts = observabilityAlerts.filter(
      (alert) => alert.relatedAlertIds.length > 0
    );

    expect(clusteredAlerts.length).toBeGreaterThanOrEqual(1);

    for (const alert of observabilityAlerts) {
      expect(alert.relatedAlertIds).not.toContain(alert.id);
      for (const relatedId of alert.relatedAlertIds) {
        expect(alertIds.has(relatedId)).toBe(true);
      }
    }
  });

  it("should reserve paging for high-impact alerts with verified downstream context", () => {
    const pagingAlerts = observabilityAlerts.filter(
      (alert) => alert.priority === "page_on_call"
    );

    expect(pagingAlerts.length).toBeGreaterThanOrEqual(1);

    for (const alert of pagingAlerts) {
      expect(["high", "critical"]).toContain(alert.businessCriticality);
      expect(alert.affectedAssets.length).toBeGreaterThanOrEqual(2);
      expect(alert.downstreamPipelineIds.length).toBeGreaterThanOrEqual(1);

      for (const downstreamId of alert.downstreamPipelineIds) {
        expect(pipelineIds.has(downstreamId)).toBe(true);
        expect(hasDownstreamPath(alert.pipelineId, downstreamId)).toBe(true);
      }
    }
  });
});

describe("demo-data: computeMetrics", () => {
  it("should return correct totalPipelines count", () => {
    const m = computeMetrics();
    expect(m.totalPipelines).toBe(8);
  });

  it("should compute runs today greater than zero", () => {
    const m = computeMetrics();
    expect(m.totalRunsToday).toBeGreaterThan(0);
  });

  it("should compute overallQualityScore between 0 and 100", () => {
    const m = computeMetrics();
    expect(m.overallQualityScore).toBeGreaterThanOrEqual(0);
    expect(m.overallQualityScore).toBeLessThanOrEqual(100);
  });

  it("should compute totalThroughputRps greater than zero", () => {
    const m = computeMetrics();
    expect(m.totalThroughputRps).toBeGreaterThan(0);
  });

  it("should compute uptimePercent between 0 and 100", () => {
    const m = computeMetrics();
    expect(m.uptimePercent).toBeGreaterThanOrEqual(0);
    expect(m.uptimePercent).toBeLessThanOrEqual(100);
  });

  it("should compute quality checks breakdown by status", () => {
    const m = computeMetrics();
    const { pass, warn, fail, pending } = m.qualityChecksByStatus;
    // 12 total checks: 8 pass, 3 warn, 1 fail, 0 pending
    expect(pass).toBe(8);
    expect(warn).toBe(3);
    expect(fail).toBe(1);
    expect(pending).toBe(0);
    expect(pass + warn + fail + pending).toBe(12);
  });

  it("should compute errorRatePercent between 0 and 100", () => {
    const m = computeMetrics();
    expect(m.errorRatePercent).toBeGreaterThanOrEqual(0);
    expect(m.errorRatePercent).toBeLessThanOrEqual(100);
  });

  it("should compute non-zero errorRatePercent when failures exist", () => {
    const m = computeMetrics();
    // There are failed runs with errors, so error rate should be > 0
    expect(m.errorRatePercent).toBeGreaterThan(0);
  });
});

describe("demo-data: pipeline lineage", () => {
  const knownIds = new Set(pipelines.map((p) => p.id));

  it("should only reference valid pipeline IDs as upstream dependencies", () => {
    for (const p of pipelines) {
      for (const upstreamId of p.upstreamPipelineIds) {
        expect(knownIds.has(upstreamId)).toBe(true);
      }
    }
  });

  it("should not have any pipeline depending on itself", () => {
    for (const p of pipelines) {
      expect(p.upstreamPipelineIds).not.toContain(p.id);
    }
  });

  it("should have no circular dependencies", () => {
    // Build adjacency list and check for cycles via DFS
    const adj = new Map<string, string[]>();
    for (const p of pipelines) {
      adj.set(p.id, p.upstreamPipelineIds);
    }
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(id: string): boolean {
      if (inStack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      inStack.add(id);
      for (const upId of adj.get(id) ?? []) {
        if (hasCycle(upId)) return true;
      }
      inStack.delete(id);
      return false;
    }

    for (const p of pipelines) {
      expect(hasCycle(p.id)).toBe(false);
    }
  });

  it("should have at least one pipeline with upstream dependencies", () => {
    const withUpstream = pipelines.filter(
      (p) => p.upstreamPipelineIds.length > 0
    );
    expect(withUpstream.length).toBeGreaterThanOrEqual(1);
  });

  it("should have at least one source pipeline with no upstream dependencies", () => {
    const sourcePipelines = pipelines.filter(
      (p) => p.upstreamPipelineIds.length === 0
    );
    expect(sourcePipelines.length).toBeGreaterThanOrEqual(1);
  });
});
