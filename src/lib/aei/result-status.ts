import type { ApiResult } from "./api-client";

export type ResultStatus = "available" | "small" | "check" | "empty" | "unavailable";
export type StatusFilter = "all" | "available" | "small" | "check";

export function needsDataCheck(result: ApiResult): boolean {
  return result.missingCount > 0 || result.invalidCount > 0 || result.uninterpretableCount > 0;
}

/** Describe returned aggregates only. Routine I/repeat exclusions are not errors. */
export function resultStatus(result: ApiResult): ResultStatus {
  if (result.dataQualityStatus === "insufficient-data") return "small";
  if (needsDataCheck(result)) return "check";
  if (result.dataQualityStatus === "zero-denominator") {
    return result.selectedIsolateCount > 0 || result.intermediateCount > 0 || result.repeatedIsolateCount > 0 ? "small" : "empty";
  }
  return "available";
}

export function matchesStatusFilter(result: ApiResult, filter: StatusFilter): boolean {
  return filter === "all" || (filter === "check" ? needsDataCheck(result) : resultStatus(result) === filter);
}