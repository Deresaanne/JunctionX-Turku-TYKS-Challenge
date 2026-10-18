import { describe, expect, it } from "vitest";
import { calculateResistance, DEDUP_POLICY, MINIMUM_DENOMINATOR, type Observation } from "./resistance";
import { matchesStatusFilter, resultStatus } from "./result-status";
import type { ApiResult } from "./api-client";

function fixture(count: number, result = "S", missing = 0): ApiResult {
  const observations: Observation[] = Array.from({ length: count + missing }, (_, i) => ({
    isolateId: `i${i}`, patientId: `p${i}`, organism: "Escherichia coli", sampleDate: "2024-06-01", cultureId: `c${i}`, isolateNo: 1, ward: "W", specimen: "S", cultureResult: "positive", results: [{ antibiotic: "AMP", result: i < count ? result : null }],
  }));
  const calculation = calculateResistance(observations, { period: { kind: "annual", isoYear: 2024 }, deduplicationPolicy: DEDUP_POLICY, antibiotics: ["AMP"] });
  const row = calculation.results[0];
  if (!row) throw new Error("Fixture needs a row");
  return { ...row, dimensions: { organism: "Escherichia coli", antibiotic: "AMP" }, dataQualityStatus: row.dataQualityStatus as ApiResult["dataQualityStatus"], period: calculation.period, warnings: [] };
}

describe("Plain resistance statuses preserve engine semantics", () => {
  it("uses the actual minimum of 30 and keeps the rate available at the boundary", () => {
    expect(MINIMUM_DENOMINATOR).toBe(30);
    const row = fixture(30, "R");
    expect(resultStatus(row)).toBe("available");
    expect(row.percentage).toBe(100);
  });
  it("keeps a 24-result sample hidden and reports its real eligible count", () => {
    const row = fixture(24);
    expect(resultStatus(row)).toBe("small");
    expect(row.eligibleDenominator).toBe(24);
    expect(row.percentage).toBeNull();
  });
  it("marks missing data for checking without hiding a valid rate", () => {
    const row = fixture(30, "S", 2);
    expect(resultStatus(row)).toBe("check");
    expect(row.missingCount).toBe(2);
    expect(row.percentage).toBe(0);
  });
  it("marks invalid-only data for checking rather than no results", () => {
    const row = fixture(3, "invalid");
    expect(resultStatus(row)).toBe("check");
    expect(row.invalidCount).toBe(3);
  });
  it("does not call valid intermediate-only data missing", () => {
    const row = fixture(4, "I");
    expect(resultStatus(row)).toBe("small");
    expect(row.intermediateCount).toBe(4);
    expect(matchesStatusFilter(row, "check")).toBe(false);
  });
  it("labels a genuine empty aggregate as no results", () => {
    const row = { ...fixture(1), selectedIsolateCount: 0, eligibleDenominator: 0, susceptibleCount: 0, percentage: null, dataQualityStatus: "zero-denominator" as const };
    expect(resultStatus(row)).toBe("empty");
  });
  it("keeps small samples with missing data in both relevant filters", () => {
    const row = fixture(24, "S", 1);
    expect(resultStatus(row)).toBe("small");
    expect(matchesStatusFilter(row, "small")).toBe(true);
    expect(matchesStatusFilter(row, "check")).toBe(true);
    expect(matchesStatusFilter(row, "available")).toBe(false);
    expect(matchesStatusFilter(row, "all")).toBe(true);
  });
  it("does not treat intermediate or repeated exclusions as data errors", () => {
    const row = { ...fixture(30), intermediateCount: 2, repeatedIsolateCount: 4 };
    expect(resultStatus(row)).toBe("available");
    expect(matchesStatusFilter(row, "check")).toBe(false);
  });
});