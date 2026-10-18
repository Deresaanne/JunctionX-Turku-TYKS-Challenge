import { supabase } from "@/integrations/supabase/client";

/** Browser client for the Checkpoint 5 read-only JSON APIs. Sends the current
 * app session token; the API enforces roles server-side. Never sends privileged keys. */
export async function aeiApi<T>(path: string, params?: URLSearchParams): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const url = `/api/public/aei/${path}${params?.size ? `?${params}` : ""}`;
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new Error(body?.error?.message ?? `API error ${res.status}`);
  return body as T;
}

export type CatalogData = {
  organisms: string[];
  antibiotics: { code: string; label_en: string; label_fi: string }[];
  wards: { code: string; label_en: string; label_fi: string }[];
  specimens: { code: string; label_en: string; label_fi: string }[];
  periods: {
    annual: { kind: "annual"; isoYear: number; start: string; endExclusive: string }[];
    fourWeek: { kind: "four-week"; isoYear: number; isoWeek: number; start: string; endExclusive: string }[];
  };
  dateRange: { start: string | null; end: string | null };
};

export type ApiResult = {
  dimensions: { organism: string; antibiotic: string; ward?: string; specimen?: string };
  period: { kind: string; isoYear: number; isoWeek?: number; start: string; endExclusive: string };
  resistantCount: number;
  susceptibleCount: number;
  intermediateCount: number;
  eligibleDenominator: number;
  selectedIsolateCount: number;
  percentage: number | null;
  dataQualityStatus: "zero-denominator" | "insufficient-data" | "reportable-with-exclusions" | "reportable";
  missingCount: number;
  invalidCount: number;
  uninterpretableCount: number;
  repeatedIsolateCount: number;
  warnings: string[];
};

export type ApiEnvelope = {
  period: ApiResult["period"];
  policy: string;
  status: "ok" | "no-data";
  warnings: string[];
  results: ApiResult[];
};
