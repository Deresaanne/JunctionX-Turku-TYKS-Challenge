import Papa from "papaparse";
// Pure, browser- and server-safe CSV parsing and row validation for AEI imports.
// The server re-runs these validators on every batch; client-side runs are only a preview.

export type Dataset = "wards" | "antibiotics" | "patients" | "cultures" | "isolates" | "susceptibility";

/** Import order: a dataset may only reference datasets earlier in this list. */
export const DATASET_ORDER: Dataset[] = [
  "wards",
  "antibiotics",
  "patients",
  "cultures",
  "isolates",
  "susceptibility",
];

export const EXPECTED_HEADERS: Record<Dataset, string[]> = {
  wards: ["ward_code", "ward_fi", "ward_en", "ward_type", "institution"],
  antibiotics: ["antibiotic", "antibiotic_code", "antibiotic_fi", "class", "reported_for"],
  patients: ["patient_id", "sex", "birth_year", "home_area"],
  cultures: [
    "culture_id", "patient_id", "age_years", "sample_date", "iso_year", "iso_week", "ward_code",
    "ward_fi", "ward_en", "ward_type", "institution", "admission_date", "specimen", "specimen_fi",
    "result", "n_isolates",
  ],
  isolates: ["isolate_id", "culture_id", "isolate_no", "organism", "quantity", "esbl", "mrsa", "vre", "cpe"],
  susceptibility: [
    "isolate_id", "culture_id", "organism", "antibiotic", "antibiotic_code", "antibiotic_fi", "result", "guideline",
  ],
};

export type RawRow = Record<string, string>;
const g = (r: RawRow, f: string): string => r[f] ?? "";
export type RowError = { line: number; field?: string; message: string };

/** CSV records retain strings; diagnostics use 1-based logical record numbers. */
export function parseCsv(text: string): { headers: string[]; rows: RawRow[]; errors: RowError[] } {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: true });
  const headers = (parsed.data[0] ?? []).map(h => h.trim());
  const errors: RowError[] = parsed.errors.map(e => ({ line: (e.row ?? 0) + 1, message: e.message }));
  const rows = parsed.data.slice(1).map((cells, i) => {
    if (cells.length !== headers.length) errors.push({ line: i + 2, message: `Expected ${headers.length} fields, received ${cells.length}` });
    return Object.fromEntries(headers.map((h, j) => [h, (cells[j] ?? "").trim()]));
  });
  return { headers, rows, errors };
}

export function checkHeaders(dataset: Dataset, headers: string[]): string[] {
  const expected = EXPECTED_HEADERS[dataset];
  const missing = expected.filter((h) => !headers.includes(h));
  const extra = headers.filter((h) => !expected.includes(h));
  const problems: string[] = [];
  if (new Set(headers).size !== headers.length) problems.push("Duplicate column names");
  if (missing.length) problems.push(`Missing columns: ${missing.join(", ")}`);
  if (extra.length) problems.push(`Unexpected columns: ${extra.join(", ")}`);
  return problems;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function toInt(s: string): number | null {
  const n = Number(s);
  return /^-?\d+$/.test(s) && Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n : null;
}

/** Marker flag: "1" → true, "0" → false, blank/"NA"/"unknown" → null. Never inferred. */
export function parseMarker(s: string): boolean | null | "invalid" {
  const v = s.trim().toLowerCase();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  if (v === "" || v === "na" || v === "unknown" || v === "null") return null;
  return "invalid";
}

/** S, I and R are kept distinct; anything else is rejected. */
export const SIR = ["S", "I", "R"] as const;
export function parseSir(s: string): "S" | "I" | "R" | null {
  const v = s.trim();
  return (SIR as readonly string[]).includes(v) ? (v as "S" | "I" | "R") : null;
}

export const CULTURE_RESULTS = ["positive", "negative", "mixed_growth"] as const;

export type ValidatedRow = { key: string; record: Record<string, unknown>; refs: Record<string, string> };

/**
 * Validates one row. `line` is the 1-based file line (header = line 1).
 * `refs` lists foreign keys the server must confirm exist before committing.
 */
export function validateRow(
  dataset: Dataset,
  r: RawRow,
  line: number,
): { ok: true; value: ValidatedRow } | { ok: false; errors: RowError[] } {
  const errors: RowError[] = [];
  const req = (f: string) => {
    if (!g(r, f)) errors.push({ line, field: f, message: "required" });
    return g(r, f);
  };
  const int = (f: string, opt = false) => {
    const v = g(r, f);
    if (v === "" && opt) return null;
    const n = toInt(v);
    if (n === null) errors.push({ line, field: f, message: `not an integer: "${v}"` });
    return n;
  };

  let value: ValidatedRow | null = null;
  switch (dataset) {
    case "wards": {
      const code = req("ward_code");
      const type = req("ward_type");
      if (type && type !== "in" && type !== "out") errors.push({ line, field: "ward_type", message: `must be in/out, got "${type}"` });
      value = {
        key: code,
        record: { ward_code: code, label_fi: req("ward_fi"), label_en: req("ward_en"), ward_type: type, institution: req("institution") },
        refs: {},
      };
      break;
    }
    case "antibiotics": {
      const code = req("antibiotic_code");
      value = {
        key: code,
        record: {
          antibiotic_code: code, label_en: req("antibiotic"), label_fi: req("antibiotic_fi"),
          drug_class: req("class"), reported_for: req("reported_for"),
        },
        refs: {},
      };
      break;
    }
    case "patients": {
      const id = req("patient_id");
      value = {
        key: id,
        record: { patient_id: id, sex: g(r, "sex") || null, birth_year: int("birth_year", true), home_area: g(r, "home_area") || null },
        refs: {},
      };
      break;
    }
    case "cultures": {
      const id = req("culture_id");
      const sd = req("sample_date");
      if (sd && !isValidDate(sd)) errors.push({ line, field: "sample_date", message: `invalid date "${sd}"` });
      const ad = g(r, "admission_date") ?? "";
      if (ad && !isValidDate(ad)) errors.push({ line, field: "admission_date", message: `invalid date "${ad}"` });
      const result = req("result");
      if (result && !(CULTURE_RESULTS as readonly string[]).includes(result))
        errors.push({ line, field: "result", message: `unknown culture result "${result}"` });
      const week = int("iso_week");
      if (week !== null && (week < 1 || week > 53)) errors.push({ line, field: "iso_week", message: "out of range" });
      const n = int("n_isolates");
      if (n !== null && n < 0) errors.push({ line, field: "n_isolates", message: "must be non-negative" });
      value = {
        key: id,
        record: {
          culture_id: id, patient_id: req("patient_id"), age_years: int("age_years", true), sample_date: sd,
          iso_year: int("iso_year"), iso_week: week, ward_code: req("ward_code"), admission_date: ad || null,
          specimen_code: req("specimen"), result, n_isolates: n,
        },
        refs: { patient_id: g(r, "patient_id"), ward_code: g(r, "ward_code"), specimen_code: g(r, "specimen") },
      };
      break;
    }
    case "isolates": {
      const id = req("isolate_id");
      const flags: Record<string, boolean | null> = {};
      for (const f of ["esbl", "mrsa", "vre", "cpe"]) {
        const m = parseMarker(g(r, f));
        if (m === "invalid") errors.push({ line, field: f, message: `invalid marker value "${g(r, f)}"` });
        else flags[f] = m;
      }
      value = {
        key: id,
        record: {
          isolate_id: id, culture_id: req("culture_id"), isolate_no: int("isolate_no"),
          organism: req("organism"), quantity: g(r, "quantity") || null, ...flags,
        },
        refs: { culture_id: g(r, "culture_id") },
      };
      break;
    }
    case "susceptibility": {
      const iso = req("isolate_id");
      const code = req("antibiotic_code");
      const sir = parseSir(g(r, "result") ?? "");
      if (!sir) errors.push({ line, field: "result", message: `must be S, I or R, got "${g(r, "result")}"` });
      value = {
        key: `${iso}|${code}`,
        record: { isolate_id: iso, antibiotic_code: code, result: sir, guideline: req("guideline") },
        refs: { isolate_id: iso, antibiotic_code: code },
      };
      break;
    }
  }
  if (value?.record["birth_year"] != null && (Number(value.record["birth_year"]) < 1880 || Number(value.record["birth_year"]) > 2100))
    errors.push({ line, field: "birth_year", message: "outside existing database range 1880–2100" });
  if (!value) return { ok: false, errors: [{ line, message: "Unknown dataset" }] };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Lines whose natural key repeats an earlier line in the same file. */
export function findInFileDuplicates(dataset: Dataset, rows: RawRow[]): RowError[] {
  const seen = new Map<string, number>();
  const out: RowError[] = [];
  rows.forEach((r, i) => {
    const key =
      dataset === "susceptibility" ? `${g(r, "isolate_id")}|${g(r, "antibiotic_code")}` :
      g(r, EXPECTED_HEADERS[dataset][dataset === "antibiotics" ? 1 : 0] ?? "");
    const line = i + 2;
    const prev = seen.get(key);
    if (prev) out.push({ line, message: `duplicate key "${key}" (first seen on line ${prev})` });
    else seen.set(key, line);
  });
  return out;
}
