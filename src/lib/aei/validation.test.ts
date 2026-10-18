import { describe, expect, it } from "vitest";
import { findInFileDuplicates, parseCsv, parseMarker, parseSir, validateRow } from "./validation";

describe("susceptibility categories", () => {
  it("keeps I distinct from S and R", () => {
    expect(parseSir("I")).toBe("I");
    expect(parseSir("S")).toBe("S");
    expect(parseSir("R")).toBe("R");
  });
  it("rejects values other than S, I, R", () => {
    const r = validateRow("susceptibility", { isolate_id: "X-1", antibiotic_code: "AMP", result: "SDD", guideline: "EUCAST 2024" }, 2);
    expect(r.ok).toBe(false);
  });
});

describe("resistance markers", () => {
  it("leaves blank or unknown markers as null instead of 0", () => {
    expect(parseMarker("")).toBeNull();
    expect(parseMarker("NA")).toBeNull();
    expect(parseMarker("0")).toBe(false);
    expect(parseMarker("1")).toBe(true);
  });
  it("rejects unrecognised marker values", () => {
    expect(parseMarker("2")).toBe("invalid");
  });
});

describe("cultures", () => {
  const base = {
    culture_id: "C1", patient_id: "P1", age_years: "50", sample_date: "2023-10-02", iso_year: "2023", iso_week: "40",
    ward_code: "ED", admission_date: "", specimen: "urine", result: "mixed_growth", n_isolates: "0",
  };
  it("accepts a blank admission date", () => {
    const r = validateRow("cultures", base, 2);
    expect(r.ok).toBe(true);
  });
  it("rejects impossible dates", () => {
    expect(validateRow("cultures", { ...base, sample_date: "2023-02-30" }, 2).ok).toBe(false);
  });
  it("preserves mixed growth with isolate results without a clinical inference", () => {
    expect(validateRow("cultures", { ...base, n_isolates: "1" }, 2).ok).toBe(true);
  });
});

describe("csv import", () => {
  it("strips Windows line endings and BOM", () => {
    const { headers, rows } = parseCsv("\uFEFFa,b\r\n1,2\r\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });
  it("detects duplicate keys within a file", () => {
    const d = findInFileDuplicates("susceptibility", [
      { isolate_id: "X-1", antibiotic_code: "AMP" },
      { isolate_id: "X-1", antibiotic_code: "AMP" },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(3);
  });
});
