import { describe, it, expect } from "vitest";
import {
  pipelines,
  pipelineRuns,
  sourceConnectors,
  etlJobs,
  dataQualityChecks,
  computeMetrics,
} from "@/lib/demo-data";
import type { Pipeline, PipelineRun } from "@/lib/types";

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
