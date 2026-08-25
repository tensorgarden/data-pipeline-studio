import { describe, it, expect } from "vitest";
import {
  pipelines,
  pipelineRuns,
  sourceConnectors,
  dataFreshnessRecords,
  runErrorBreakdowns,
  schemaDriftEvents,
  observabilityAlerts,
  pipelineCostSignals,
  pipelineRecoveryValidations,
  partitionFreshnessRecords,
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

  it("should route affected assets to named downstream owners", () => {
    for (const alert of observabilityAlerts) {
      const assetNames = new Set(
        alert.affectedAssets.map((asset) => asset.name)
      );

      expect(assetNames.size).toBe(alert.affectedAssets.length);
      for (const asset of alert.affectedAssets) {
        expect(asset.name.trim().length).toBeGreaterThan(10);
        expect(asset.ownerTeam.trim().length).toBeGreaterThan(6);
        expect(asset.impactSummary.length).toBeGreaterThan(80);
      }
    }
  });

  it("should give paging incidents a multi-team blast radius", () => {
    const pagingAlerts = observabilityAlerts.filter(
      (alert) => alert.priority === "page_on_call"
    );

    expect(pagingAlerts.length).toBeGreaterThanOrEqual(1);
    for (const alert of pagingAlerts) {
      const affectedOwnerTeams = new Set(
        alert.affectedAssets.map((asset) => asset.ownerTeam)
      );
      expect(affectedOwnerTeams.size).toBeGreaterThanOrEqual(2);
      expect(
        alert.affectedAssets.some((asset) => asset.assetType === "dashboard")
      ).toBe(true);
    }
  });

  it("should assign alert ownership with time-bound response plans", () => {
    for (const alert of observabilityAlerts) {
      const triggeredAt = Date.parse(alert.triggeredAt);
      const reviewDueAt = Date.parse(alert.response.reviewDueAt);

      expect(alert.response.ownerTeam.trim().length).toBeGreaterThan(6);
      expect(alert.response.ownerTeam.toLowerCase()).not.toContain("automation");
      expect(alert.response.escalationPolicy.length).toBeGreaterThan(80);
      expect(Number.isNaN(reviewDueAt)).toBe(false);
      expect(reviewDueAt).toBeGreaterThan(triggeredAt);

      if (alert.response.acknowledgedAt) {
        const acknowledgedAt = Date.parse(alert.response.acknowledgedAt);
        expect(Number.isNaN(acknowledgedAt)).toBe(false);
        expect(acknowledgedAt).toBeGreaterThanOrEqual(triggeredAt);
        expect(acknowledgedAt).toBeLessThanOrEqual(reviewDueAt);
      }

      if (alert.priority === "page_on_call") {
        const acknowledgedAt = Date.parse(alert.response.acknowledgedAt ?? "");
        expect(alert.response.acknowledgedAt).not.toBeNull();
        expect(acknowledgedAt - triggeredAt).toBeLessThanOrEqual(15 * 60_000);
        expect(reviewDueAt - triggeredAt).toBeLessThanOrEqual(30 * 60_000);
      }
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

  it("should carry alert-correlation context that suppresses duplicate paging noise", () => {
    for (const alert of observabilityAlerts) {
      const { correlation } = alert;
      expect(correlation.suppressionWindowMinutes).toBeGreaterThanOrEqual(5);
      expect(correlation.suppressionWindowMinutes).toBeLessThanOrEqual(240);
      expect(correlation.suppressedDuplicateCount).toBeGreaterThanOrEqual(0);
      expect(correlation.clusterReason.length).toBeGreaterThan(60);

      if (correlation.rootCauseAlertId) {
        expect(alertIds.has(correlation.rootCauseAlertId)).toBe(true);
        expect(correlation.rootCauseAlertId).not.toBe(alert.id);
      }
    }

    const rootCauseAlerts = observabilityAlerts.filter(
      (alert) => alert.correlation.suppressedDuplicateCount > 0
    );
    expect(rootCauseAlerts.length).toBeGreaterThanOrEqual(1);

    for (const alert of rootCauseAlerts) {
      expect(alert.priority).toBe("page_on_call");
      expect(alert.relatedAlertIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should keep downstream symptom alerts grouped under their root cause", () => {
    const childAlerts = observabilityAlerts.filter(
      (alert) => alert.correlation.rootCauseAlertId
    );

    expect(childAlerts.length).toBeGreaterThanOrEqual(1);

    for (const alert of childAlerts) {
      const root = observabilityAlerts.find(
        (candidate) => candidate.id === alert.correlation.rootCauseAlertId
      );

      expect(root).toBeDefined();
      expect(root?.relatedAlertIds).toContain(alert.id);
      expect(alert.priority).not.toBe("page_on_call");
      expect(alert.correlation.suppressionWindowMinutes).toBe(
        root?.correlation.suppressionWindowMinutes
      );
    }
  });
});

describe("demo-data: incident recovery validation", () => {
  const pipelineIds = new Set(pipelines.map((pipeline) => pipeline.id));
  const runById = new Map(pipelineRuns.map((run) => [run.id, run]));
  const alertIds = new Set(observabilityAlerts.map((alert) => alert.id));

  it("should tie replay validation gates to valid operational context", () => {
    const validationIds = new Set(
      pipelineRecoveryValidations.map((validation) => validation.id)
    );

    expect(pipelineRecoveryValidations.length).toBeGreaterThanOrEqual(3);
    expect(validationIds.size).toBe(pipelineRecoveryValidations.length);

    for (const validation of pipelineRecoveryValidations) {
      expect(pipelineIds.has(validation.pipelineId)).toBe(true);
      expect(validation.qualityChecksRequired).toBeGreaterThan(0);
      expect(validation.qualityChecksPassed).toBeGreaterThanOrEqual(0);
      expect(validation.qualityChecksPassed).toBeLessThanOrEqual(
        validation.qualityChecksRequired
      );
      expect(Date.parse(validation.replayWindowEnd)).toBeGreaterThan(
        Date.parse(validation.replayWindowStart)
      );
      expect(Date.parse(validation.publishDecisionDueAt)).toBeGreaterThan(
        Date.parse(validation.replayWindowEnd)
      );
      expect(validation.ownerTeam.trim().length).toBeGreaterThan(6);

      if (validation.incidentAlertId) {
        expect(alertIds.has(validation.incidentAlertId)).toBe(true);
      }
      if (validation.replayRunId) {
        expect(runById.has(validation.replayRunId)).toBe(true);
      }
    }
  });

  it("should expose complete row-level reconciliation coverage", () => {
    const incompleteComparisons = pipelineRecoveryValidations.filter(
      (validation) => validation.recordsCompared < validation.recordsExpected
    );

    expect(incompleteComparisons.length).toBeGreaterThanOrEqual(1);

    for (const validation of pipelineRecoveryValidations) {
      expect(validation.recordsExpected).toBeGreaterThan(0);
      expect(validation.recordsCompared).toBeGreaterThanOrEqual(0);
      expect(validation.recordsCompared).toBeLessThanOrEqual(
        validation.recordsExpected
      );

      if (validation.status === "ready_to_publish") {
        expect(validation.recordsCompared).toBe(validation.recordsExpected);
      }
    }

    for (const validation of incompleteComparisons) {
      expect(validation.status).not.toBe("ready_to_publish");
    }
  });

  it("should quarantine unresolved validation exceptions before publication", () => {
    const unresolved = pipelineRecoveryValidations.filter(
      (validation) =>
        validation.validationFailedRecords +
          validation.validationPendingRecords +
          validation.validationSuspendedRecords >
        0
    );

    expect(unresolved.length).toBeGreaterThanOrEqual(1);

    for (const validation of pipelineRecoveryValidations) {
      expect(validation.validationFailedRecords).toBeGreaterThanOrEqual(0);
      expect(validation.validationPendingRecords).toBeGreaterThanOrEqual(0);
      expect(validation.validationSuspendedRecords).toBeGreaterThanOrEqual(0);
      expect(validation.exceptionRemediationPlan.length).toBeGreaterThan(80);

      const exceptionCount =
        validation.validationFailedRecords +
        validation.validationPendingRecords +
        validation.validationSuspendedRecords;

      if (exceptionCount > 0) {
        expect(validation.validationExceptionStatus).not.toBe("cleared");
        expect(validation.quarantineLocation).toMatch(/^s3:\/\/recovery-quarantine\//);
        expect(validation.status).not.toBe("ready_to_publish");
      } else {
        expect(validation.validationExceptionStatus).toBe("cleared");
        expect(validation.quarantineLocation).toBeNull();
      }
    }
  });

  it("should reconcile replay content beyond row-count checks", () => {
    const statuses = new Set(
      pipelineRecoveryValidations.map(
        (validation) => validation.contentReconciliationStatus
      )
    );

    expect(statuses.has("pending")).toBe(true);
    expect(statuses.has("mismatch")).toBe(true);
    expect(statuses.has("matched")).toBe(true);

    for (const validation of pipelineRecoveryValidations) {
      expect(validation.contentReconciliationEvidence.length).toBeGreaterThan(80);

      if (validation.contentReconciliationStatus === "pending") {
        expect(
          validation.sourceChecksum === null || validation.targetChecksum === null
        ).toBe(true);
      } else {
        expect(validation.sourceChecksum?.length).toBeGreaterThan(10);
        expect(validation.targetChecksum?.length).toBeGreaterThan(10);

        if (validation.contentReconciliationStatus === "matched") {
          expect(validation.sourceChecksum).toBe(validation.targetChecksum);
        } else {
          expect(validation.sourceChecksum).not.toBe(validation.targetChecksum);
        }
      }
    }
  });

  it("should keep content mismatches out of ready-to-publish", () => {
    const unreconciled = pipelineRecoveryValidations.filter(
      (validation) => validation.contentReconciliationStatus !== "matched"
    );

    expect(unreconciled.length).toBeGreaterThanOrEqual(1);
    for (const validation of unreconciled) {
      expect(validation.status).not.toBe("ready_to_publish");
    }
  });

  it("should document replay write semantics and duplicate evidence", () => {
    const writeModes = new Set(
      pipelineRecoveryValidations.map((validation) => validation.replayWriteMode)
    );

    expect(writeModes.has("append")).toBe(true);
    expect(writeModes.has("upsert")).toBe(true);
    expect(writeModes.has("partition_overwrite")).toBe(true);

    for (const validation of pipelineRecoveryValidations) {
      expect(validation.idempotencyEvidence.length).toBeGreaterThan(80);
      if (validation.duplicateRowsDetected !== null) {
        expect(validation.duplicateRowsDetected).toBeGreaterThanOrEqual(0);
      }

      if (validation.idempotencyVerified) {
        expect(validation.deduplicationKey?.trim().length).toBeGreaterThan(3);
        expect(validation.duplicateRowsDetected).toBe(0);
      }
    }
  });

  it("should record bounded late-arrival evidence for every replay", () => {
    for (const validation of pipelineRecoveryValidations) {
      expect(validation.allowedLatenessMinutes).toBeGreaterThan(0);
      expect(validation.lateArrivalEvidence.length).toBeGreaterThan(80);

      if (validation.lateRecordsDetected !== null) {
        expect(validation.lateRecordsDetected).toBeGreaterThanOrEqual(0);
      }
      if (validation.eventTimeWatermarkVerified) {
        expect(validation.lateRecordsDetected).not.toBeNull();
      }
    }
  });

  it("should keep unresolved late arrivals out of ready-to-publish", () => {
    const incompleteWindows = pipelineRecoveryValidations.filter(
      (validation) =>
        !validation.eventTimeWatermarkVerified ||
        validation.lateRecordsDetected === null ||
        validation.lateRecordsDetected > 0
    );

    expect(incompleteWindows.length).toBeGreaterThanOrEqual(1);
    for (const validation of incompleteWindows) {
      expect(validation.status).not.toBe("ready_to_publish");
    }
  });

  it("should keep non-idempotent replay attempts out of ready-to-publish", () => {
    const unsafeReplays = pipelineRecoveryValidations.filter(
      (validation) =>
        !validation.idempotencyVerified ||
        validation.duplicateRowsDetected === null ||
        validation.duplicateRowsDetected > 0
    );

    expect(unsafeReplays.length).toBeGreaterThanOrEqual(1);
    for (const validation of unsafeReplays) {
      expect(validation.status).not.toBe("ready_to_publish");
    }
  });

  it("should keep publication blocked until replay evidence is complete", () => {
    for (const validation of pipelineRecoveryValidations) {
      if (validation.status === "ready_to_publish") {
        const replayRun = runById.get(validation.replayRunId ?? "");
        expect(replayRun?.status).toBe("success");
        expect(validation.qualityChecksPassed).toBe(
          validation.qualityChecksRequired
        );
        expect(validation.downstreamWatermarkVerified).toBe(true);
        expect(validation.eventTimeWatermarkVerified).toBe(true);
        expect(validation.lateRecordsDetected).toBe(0);
        expect(validation.rowCountVariancePercent).not.toBeNull();
        expect(validation.contentReconciliationStatus).toBe("matched");
        expect(validation.sourceChecksum).toBe(validation.targetChecksum);
        expect(validation.idempotencyVerified).toBe(true);
        expect(validation.duplicateRowsDetected).toBe(0);
        expect(validation.deduplicationKey).not.toBeNull();
        expect(validation.estimatedReplayCostUsd).not.toBeNull();
        expect(
          validation.replayCostApprovalStatus === "approved" ||
            validation.replayCostApprovalStatus === "within_threshold"
        ).toBe(true);
        expect(validation.blockingReason).toBeNull();
      } else {
        expect(validation.blockingReason?.length).toBeGreaterThan(80);
        expect(
          validation.qualityChecksPassed < validation.qualityChecksRequired ||
            !validation.downstreamWatermarkVerified ||
            !validation.eventTimeWatermarkVerified ||
            validation.lateRecordsDetected !== 0 ||
            validation.replayRunId === null ||
            validation.contentReconciliationStatus !== "matched" ||
            !validation.idempotencyVerified ||
            validation.duplicateRowsDetected !== 0 ||
            validation.estimatedReplayCostUsd === null ||
            validation.replayCostApprovalStatus === "pending_estimate" ||
            validation.replayCostApprovalStatus === "awaiting_approval"
        ).toBe(true);
      }
    }
  });

  it("should cover every actionable incident with a recovery validation gate", () => {
    const coveredAlertIds = new Set(
      pipelineRecoveryValidations
        .map((validation) => validation.incidentAlertId)
        .filter((alertId): alertId is string => alertId !== null)
    );
    const actionableAlerts = observabilityAlerts.filter(
      (alert) => alert.priority !== "watch"
    );

    expect(actionableAlerts.length).toBeGreaterThanOrEqual(1);
    for (const alert of actionableAlerts) {
      expect(coveredAlertIds.has(alert.id)).toBe(true);
    }
  });

  it("should require cost preflight approval for expensive replays", () => {
    const statuses = new Set(
      pipelineRecoveryValidations.map(
        (validation) => validation.replayCostApprovalStatus
      )
    );

    expect(statuses.has("awaiting_approval")).toBe(true);
    expect(statuses.has("approved")).toBe(true);
    expect(statuses.has("within_threshold")).toBe(true);

    for (const validation of pipelineRecoveryValidations) {
      expect(validation.replayCostApprovalThresholdUsd).toBeGreaterThan(0);
      expect(validation.replayCostEvidence.length).toBeGreaterThan(80);

      if (validation.replayCostApprovalStatus === "pending_estimate") {
        expect(validation.estimatedReplayCostUsd).toBeNull();
        expect(validation.replayCostApprover).toBeNull();
      } else {
        expect(validation.estimatedReplayCostUsd).not.toBeNull();
        expect(validation.estimatedReplayCostUsd).toBeGreaterThanOrEqual(0);
      }

      if (validation.replayCostApprovalStatus === "awaiting_approval") {
        expect(validation.estimatedReplayCostUsd).toBeGreaterThan(
          validation.replayCostApprovalThresholdUsd
        );
        expect(validation.replayCostApprover).toBeNull();
        expect(validation.status).not.toBe("ready_to_publish");
      }

      if (validation.replayCostApprovalStatus === "approved") {
        expect(validation.estimatedReplayCostUsd).toBeGreaterThan(
          validation.replayCostApprovalThresholdUsd
        );
        expect(validation.replayCostApprover?.trim().length).toBeGreaterThan(3);
      }

      if (validation.replayCostApprovalStatus === "within_threshold") {
        expect(validation.estimatedReplayCostUsd).toBeLessThanOrEqual(
          validation.replayCostApprovalThresholdUsd
        );
        expect(validation.replayCostApprover).toBeNull();
      }
    }
  });

  it("should keep unpriced or unapproved replays out of ready-to-publish", () => {
    const costBlocked = pipelineRecoveryValidations.filter(
      (validation) =>
        validation.replayCostApprovalStatus === "pending_estimate" ||
        validation.replayCostApprovalStatus === "awaiting_approval" ||
        validation.estimatedReplayCostUsd === null
    );

    expect(costBlocked.length).toBeGreaterThanOrEqual(1);
    for (const validation of costBlocked) {
      expect(validation.status).not.toBe("ready_to_publish");
    }
  });
});

describe("demo-data: pipeline cost observability", () => {
  const pipelineIds = new Set(pipelines.map((p) => p.id));

  it("should tie cost signals to valid pipeline windows and owners", () => {
    const signalIds = new Set(pipelineCostSignals.map((signal) => signal.id));

    expect(pipelineCostSignals.length).toBeGreaterThanOrEqual(3);
    expect(signalIds.size).toBe(pipelineCostSignals.length);

    for (const signal of pipelineCostSignals) {
      const windowStart = Date.parse(signal.windowStart);
      const windowEnd = Date.parse(signal.windowEnd);
      const nextReviewDueAt = Date.parse(signal.nextReviewDueAt);
      const expectedVariance =
        Math.round(
          ((signal.actualSpendUsd - signal.budgetedSpendUsd) /
            signal.budgetedSpendUsd) *
            1000
        ) / 10;

      expect(pipelineIds.has(signal.pipelineId)).toBe(true);
      expect(signal.actualSpendUsd).toBeGreaterThanOrEqual(0);
      expect(signal.budgetedSpendUsd).toBeGreaterThan(0);
      expect(signal.variancePercent).toBeCloseTo(expectedVariance, 1);
      expect(Number.isNaN(windowStart)).toBe(false);
      expect(Number.isNaN(windowEnd)).toBe(false);
      expect(Number.isNaN(nextReviewDueAt)).toBe(false);
      expect(windowEnd).toBeGreaterThan(windowStart);
      expect(nextReviewDueAt).toBeGreaterThan(windowEnd);
      expect(signal.ownerTeam.trim().length).toBeGreaterThan(6);
      expect(signal.optimizationAction.length).toBeGreaterThan(80);
    }
  });

  it("should escalate cost overruns with root-cause and review owners", () => {
    const overruns = pipelineCostSignals.filter(
      (signal) => signal.status === "overrun"
    );

    expect(overruns.length).toBeGreaterThanOrEqual(1);

    for (const signal of overruns) {
      const windowEnd = Date.parse(signal.windowEnd);
      const nextReviewDueAt = Date.parse(signal.nextReviewDueAt);

      expect(signal.actualSpendUsd).toBeGreaterThan(signal.budgetedSpendUsd);
      expect(signal.variancePercent).toBeGreaterThan(0);
      expect(signal.rootCause.length).toBeGreaterThan(80);
      expect(signal.ownerTeam.toLowerCase()).not.toContain("automation");
      expect(nextReviewDueAt - windowEnd).toBeLessThanOrEqual(24 * 60 * 60_000);
    }
  });

  it("should keep budget-watch signals visible before they become severe", () => {
    const watchSignals = pipelineCostSignals.filter(
      (signal) => signal.status === "watch"
    );
    const withinBudgetSignals = pipelineCostSignals.filter(
      (signal) => signal.status === "within_budget"
    );

    expect(watchSignals.length).toBeGreaterThanOrEqual(1);
    expect(withinBudgetSignals.length).toBeGreaterThanOrEqual(1);

    for (const signal of watchSignals) {
      expect(signal.actualSpendUsd).toBeGreaterThan(signal.budgetedSpendUsd);
      expect(signal.variancePercent).toBeGreaterThan(0);
      expect(signal.variancePercent).toBeLessThan(15);
      expect(signal.rootCause.length).toBeGreaterThan(60);
    }

    for (const signal of withinBudgetSignals) {
      expect(signal.actualSpendUsd).toBeLessThanOrEqual(signal.budgetedSpendUsd);
      expect(signal.variancePercent).toBeLessThanOrEqual(0);
    }
  });
});

describe("demo-data: recovery state progression", () => {
  const pipelineIds = new Set(pipelines.map((pipeline) => pipeline.id));

  it("should expose blocked recovery gates with named blocking reasons", () => {
    const blockedRecoveries = pipelineRecoveryValidations.filter(
      (validation) => validation.status === "blocked"
    );

    expect(blockedRecoveries.length).toBeGreaterThanOrEqual(1);

    for (const validation of blockedRecoveries) {
      expect(validation.blockingReason).not.toBeNull();
      expect(validation.blockingReason?.trim().length ?? 0).toBeGreaterThan(20);
      expect(pipelineIds.has(validation.pipelineId)).toBe(true);
    }
  });

  it("should separate validating recoveries from ready-to-publish with progress evidence", () => {
    const validatingRecoveries = pipelineRecoveryValidations.filter(
      (validation) => validation.status === "validating"
    );
    const readyRecoveries = pipelineRecoveryValidations.filter(
      (validation) => validation.status === "ready_to_publish"
    );

    expect(validatingRecoveries.length).toBeGreaterThanOrEqual(1);
    expect(readyRecoveries.length).toBeGreaterThanOrEqual(1);

    for (const validation of validatingRecoveries) {
      const incompleteQuality =
        validation.qualityChecksPassed < validation.qualityChecksRequired;
      const reconciliationPending =
        validation.contentReconciliationStatus === "pending" ||
        validation.contentReconciliationStatus === "mismatch";

      expect(
        incompleteQuality ||
          reconciliationPending ||
          validation.validationPendingRecords > 0
      ).toBe(true);
    }

    for (const validation of readyRecoveries) {
      expect(validation.qualityChecksPassed).toBe(
        validation.qualityChecksRequired
      );
      expect(validation.contentReconciliationStatus).toBe("matched");
      expect(validation.validationExceptionStatus).not.toBe("pending_triage");
      expect(validation.blockingReason).toBeNull();
    }
  });

  it("should require proof before publishing: cost approval, quality gates, and downstream verification", () => {
    const readyRecoveries = pipelineRecoveryValidations.filter(
      (validation) => validation.status === "ready_to_publish"
    );

    expect(readyRecoveries.length).toBeGreaterThanOrEqual(1);

    for (const validation of readyRecoveries) {
      if (validation.estimatedReplayCostUsd !== null) {
        expect(["approved", "within_threshold"]).toContain(
          validation.replayCostApprovalStatus
        );
        if (validation.replayCostApprovalStatus === "approved") {
          expect(validation.replayCostApprover).not.toBeNull();
          expect(validation.replayCostEvidence.length).toBeGreaterThan(40);
        }
      }

      expect(validation.qualityChecksPassed).toBe(
        validation.qualityChecksRequired
      );

      expect(validation.downstreamWatermarkVerified).toBe(true);

      if (
        validation.replayWriteMode === "upsert" ||
        validation.replayWriteMode === "partition_overwrite"
      ) {
        expect(validation.idempotencyVerified).toBe(true);
        expect(validation.duplicateRowsDetected).not.toBeNull();
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

describe("demo-data: schema drift consumer contract coordination", () => {
  const semverPattern = /^\d+\.\d+\.\d+$/;

  it("should version every drift event against its source contract", () => {
    expect(schemaDriftEvents.length).toBeGreaterThanOrEqual(4);

    for (const event of schemaDriftEvents) {
      expect(semverPattern.test(event.contractVersion)).toBe(true);
    }
  });

  it("should publish deprecation windows and named consumer teams for breaking drift", () => {
    const breakingEvents = schemaDriftEvents.filter(
      (event) => event.severity === "breaking"
    );

    expect(breakingEvents.length).toBeGreaterThanOrEqual(2);

    for (const event of breakingEvents) {
      expect(event.deprecationWindowEndsAt).not.toBeNull();
      const windowEnd = Date.parse(event.deprecationWindowEndsAt as string);
      expect(windowEnd).toBeGreaterThan(Date.parse(event.detectedAt));
      expect(event.consumerTeamsAffected.length).toBeGreaterThanOrEqual(1);

      for (const team of event.consumerTeamsAffected) {
        expect(team.trim().length).toBeGreaterThan(3);
      }

      expect(event.consumerAckStatus).not.toBe("acknowledged");
    }
  });

  it("should not require deprecation windows for additive or semantic drift", () => {
    const nonBreakingEvents = schemaDriftEvents.filter(
      (event) => event.severity !== "breaking"
    );

    expect(nonBreakingEvents.length).toBeGreaterThanOrEqual(2);

    for (const event of nonBreakingEvents) {
      expect(event.deprecationWindowEndsAt).toBeNull();
    }
  });

  it("should require consumer acknowledgement before resolved drift can close", () => {
    const resolvedEvents = schemaDriftEvents.filter(
      (event) => event.status === "resolved"
    );

    expect(resolvedEvents.length).toBeGreaterThanOrEqual(1);

    for (const event of resolvedEvents) {
      expect(event.consumerAckStatus).toBe("acknowledged");
    }
  });

  it("should show partial acknowledgement while consumer migrations are in flight", () => {
    const partialEvents = schemaDriftEvents.filter(
      (event) => event.consumerAckStatus === "partial"
    );

    expect(partialEvents.length).toBeGreaterThanOrEqual(1);

    for (const event of partialEvents) {
      expect(event.severity).toBe("breaking");
      expect(event.status).toBe("remediating");
    }
  });
});

describe("demo-data: schema drift escalation after deprecation windows expire", () => {
  const maxDetectedAt = Math.max(
    ...schemaDriftEvents.map((event) => Date.parse(event.detectedAt))
  );

  const escalatedEvents = schemaDriftEvents.filter(
    (event) => event.status === "escalated"
  );

  it("should escalate breaking drift once the deprecation window expires unacknowledged", () => {
    expect(escalatedEvents.length).toBeGreaterThanOrEqual(1);

    for (const event of escalatedEvents) {
      expect(event.severity).toBe("breaking");
      expect(event.deprecationWindowEndsAt).not.toBeNull();
      expect(event.consumerAckStatus).not.toBe("acknowledged");
      expect(event.escalatedAt).not.toBeNull();
      expect(Date.parse(event.escalatedAt as string)).toBeGreaterThan(
        Date.parse(event.deprecationWindowEndsAt as string)
      );
    }
  });

  it("should assign escalation to a named owner separate from downstream consumer teams", () => {
    for (const event of escalatedEvents) {
      expect(event.escalationOwnerTeam).not.toBeNull();
      expect((event.escalationOwnerTeam as string).trim().length).toBeGreaterThan(
        6
      );
      for (const team of event.consumerTeamsAffected) {
        expect(event.escalationOwnerTeam).not.toBe(team);
      }
    }
  });

  it("should never leave an expired unacknowledged window in ordinary remediation", () => {
    const expiredUnacknowledged = schemaDriftEvents.filter(
      (event) =>
        event.deprecationWindowEndsAt !== null &&
        Date.parse(event.deprecationWindowEndsAt) < maxDetectedAt &&
        event.consumerAckStatus !== "acknowledged"
    );

    expect(expiredUnacknowledged.length).toBeGreaterThanOrEqual(1);

    for (const event of expiredUnacknowledged) {
      expect(event.status).toBe("escalated");
      expect(event.status).not.toBe("remediating");
      expect(event.status).not.toBe("monitoring");
    }
  });
});

describe("demo-data: partition-level freshness", () => {
  const pipelineIds = new Set(pipelines.map((pipeline) => pipeline.id));

  it("should track bounded partition coverage with valid pipeline references", () => {
    const recordIds = new Set(
      partitionFreshnessRecords.map((record) => record.id)
    );

    expect(partitionFreshnessRecords.length).toBeGreaterThanOrEqual(3);
    expect(recordIds.size).toBe(partitionFreshnessRecords.length);

    for (const record of partitionFreshnessRecords) {
      expect(pipelineIds.has(record.pipelineId)).toBe(true);
      expect(record.partitionKey.trim().length).toBeGreaterThan(3);
      expect(record.expectedMaxAgeMinutes).toBeGreaterThan(0);
      expect(record.partitionsExpected).toBeGreaterThan(0);
      expect(record.partitionsFresh).toBeGreaterThanOrEqual(0);
      expect(record.partitionsFresh).toBeLessThanOrEqual(record.partitionsExpected);
      expect(Number.isNaN(Date.parse(record.checkedAt))).toBe(false);
      expect(record.impactSummary.length).toBeGreaterThan(80);
    }
  });

  it("should distinguish full, partial, and unknown partition freshness", () => {
    const statuses = new Set(
      partitionFreshnessRecords.map((record) => record.status)
    );

    expect(statuses.has("fresh")).toBe(true);
    expect(statuses.has("partial")).toBe(true);
    expect(statuses.has("unknown")).toBe(true);

    for (const record of partitionFreshnessRecords) {
      if (record.status === "fresh") {
        expect(record.partitionsFresh).toBe(record.partitionsExpected);
        expect(record.stalePartitionNames).toHaveLength(0);
      }

      if (record.status === "partial") {
        expect(record.partitionsFresh).toBeGreaterThan(0);
        expect(record.partitionsFresh).toBeLessThan(record.partitionsExpected);
        expect(record.stalePartitionNames.length).toBeGreaterThan(0);
      }

      if (record.status === "unknown") {
        expect(record.partitionsFresh).toBe(0);
        expect(record.stalePartitionNames).toHaveLength(0);
      }
    }
  });

  it("should keep partial or unknown partition evidence visible for review", () => {
    const risks = partitionFreshnessRecords.filter(
      (record) => record.status !== "fresh"
    );

    expect(risks.length).toBeGreaterThanOrEqual(2);
    expect(risks.every((record) => record.impactSummary.length > 80)).toBe(true);
  });
});

describe("demo-data: per-consumer schema migration progress", () => {
  const semverPattern = /^\d+\.\d+\.\d+$/;

  it("should track every affected consumer with bounded migration evidence", () => {
    for (const event of schemaDriftEvents) {
      expect(event.consumerMigrationProgress).toHaveLength(
        event.consumerTeamsAffected.length
      );

      const affectedTeams = new Set(event.consumerTeamsAffected);
      const progressTeams = new Set(
        event.consumerMigrationProgress.map((progress) => progress.consumerTeam)
      );
      expect(progressTeams).toEqual(affectedTeams);

      for (const progress of event.consumerMigrationProgress) {
        expect(progress.completionPercent).toBeGreaterThanOrEqual(0);
        expect(progress.completionPercent).toBeLessThanOrEqual(100);
        expect(semverPattern.test(progress.targetContractVersion)).toBe(true);
        expect(Number.isNaN(Date.parse(progress.lastUpdatedAt))).toBe(false);
        expect(progress.migrationOwner.trim().length).toBeGreaterThan(6);

        if (progress.status === "verified") {
          expect(progress.completionPercent).toBe(100);
        } else {
          expect(progress.completionPercent).toBeLessThan(100);
        }
      }
    }
  });

  it("should align aggregate acknowledgement with per-consumer completion", () => {
    for (const event of schemaDriftEvents) {
      const verified = event.consumerMigrationProgress.filter(
        (progress) => progress.status === "verified"
      );

      if (event.consumerAckStatus === "acknowledged") {
        expect(verified).toHaveLength(event.consumerMigrationProgress.length);
        expect(
          event.consumerMigrationProgress.every(
            (progress) => progress.completionPercent === 100
          )
        ).toBe(true);
      }

      if (event.consumerAckStatus === "partial") {
        expect(verified.length).toBeGreaterThan(0);
        expect(verified.length).toBeLessThan(
          event.consumerMigrationProgress.length
        );
      }

      if (event.consumerAckStatus === "pending") {
        expect(verified).toHaveLength(0);
      }
    }
  });

  it("should keep escalated and in-flight drift visibly incomplete", () => {
    const escalatedEvents = schemaDriftEvents.filter(
      (event) => event.status === "escalated"
    );
    const partialEvents = schemaDriftEvents.filter(
      (event) => event.consumerAckStatus === "partial"
    );

    expect(escalatedEvents.length).toBeGreaterThanOrEqual(1);
    expect(partialEvents.length).toBeGreaterThanOrEqual(1);

    for (const event of escalatedEvents) {
      expect(
        event.consumerMigrationProgress.some(
          (progress) => progress.status !== "verified"
        )
      ).toBe(true);
      expect(event.status).not.toBe("resolved");
    }

    for (const event of partialEvents) {
      expect(
        event.consumerMigrationProgress.some(
          (progress) => progress.status === "in_progress"
        )
      ).toBe(true);
    }
  });
});
