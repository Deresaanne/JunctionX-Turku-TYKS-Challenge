import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { AppShell } from "@/components/aei/AppShell";
import { aeiApi, type ApiEnvelope, type ApiResult, type CatalogData } from "@/lib/aei/api-client";
import { getMarkerSummary } from "@/lib/aei/resistance.functions";
import { useI18n, pickLabel, type Key } from "@/lib/aei/i18n";
import { BreakdownTable, RateHelp } from "@/components/aei/BreakdownTable";
import { ResultsUnavailable } from "@/components/aei/ResultStatus";
import { ForecastSection } from "@/components/aei/ForecastSection";
import type { ForecastResponse } from "@/lib/aei/forecast";

/** API periods are end-exclusive; show the last included day for readers. */
function lastDay(endExclusive: string) {
  const d = new Date(endExclusive.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type Search = {
  kind: "annual" | "four-week";
  isoYear?: number | undefined;
  isoWeek?: number | undefined;
  organism?: string | undefined;
  antibiotic?: string | undefined;
  ward?: string | undefined;
  specimen?: string | undefined;
};

const catalogsQuery = queryOptions({
  queryKey: ["aei", "api", "catalogs"],
  queryFn: () => aeiApi<{ data: CatalogData }>("/catalogs"),
  staleTime: 60_000,
});

const POLICY = "provisional-first-patient-organism-period";

function calcParams(s: Search, year: number, week?: number) {
  const p = new URLSearchParams({ period: s.kind, isoYear: String(year), policy: POLICY });
  if (s.kind === "four-week" && week) p.set("isoWeek", String(week));
  if (s.organism) p.set("organism", s.organism);
  if (s.antibiotic) p.set("antibiotic", s.antibiotic);
  if (s.ward) p.set("ward", s.ward);
  if (s.specimen) p.set("specimen", s.specimen);
  return p;
}

export const Route = createFileRoute("/resistance")({
  ssr: false,
  validateSearch: (raw): Search => ({
    kind: raw["kind"] === "four-week" ? "four-week" : "annual",
    isoYear: typeof raw["isoYear"] === "number" ? raw["isoYear"] : undefined,
    isoWeek: typeof raw["isoWeek"] === "number" ? raw["isoWeek"] : undefined,
    organism: typeof raw["organism"] === "string" && raw["organism"] ? raw["organism"] : undefined,
    antibiotic: typeof raw["antibiotic"] === "string" && raw["antibiotic"] ? raw["antibiotic"] : undefined,
    ward: typeof raw["ward"] === "string" && raw["ward"] ? raw["ward"] : undefined,
    specimen: typeof raw["specimen"] === "string" && raw["specimen"] ? raw["specimen"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Resistance — AEI" },
      { name: "description", content: "Antimicrobial resistance summaries, trends, breakdowns and lab-flag markers from the verified surveillance APIs." },
      { property: "og:title", content: "Resistance — AEI" },
      { property: "og:description", content: "Antimicrobial resistance summaries, trends and breakdowns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogsQuery),
  component: ResistanceDashboard,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="rounded-md border border-destructive bg-card p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
});

function WarningChips({ warnings }: { warnings: string[] }) {
  const { t } = useI18n();
  const map: Record<string, Key> = {
    "intermediate-excluded": "warn_intermediate_excluded",
    "missing-results": "warn_missing_results",
    "invalid-results": "warn_invalid_results",
    "uninterpretable-results": "warn_uninterpretable_results",
    "repeated-isolates-excluded": "warn_repeated_isolates_excluded",
    "no-data": "warn_no_data",
    "provisional-clinical-policy": "warn_provisional",
    "insufficient-sample": "insufficientSample",
    "zero-denominator": "zeroDenominator",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {warnings.filter((w) => w !== "intermediate-excluded").map((w) => (
        <span key={w} className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {map[w] ? t(map[w]) : w}
        </span>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: ApiResult["dataQualityStatus"] }) {
  const { t } = useI18n();
  const label: Record<ApiResult["dataQualityStatus"], Key> = {
    "zero-denominator": "zeroDenominator",
    "insufficient-data": "insufficientSample",
    "reportable-with-exclusions": "reportableWithExclusions",
    reportable: "reportable",
  };
  const bad = status === "zero-denominator" || status === "insufficient-data";
  return (
    <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${bad ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
      {t(label[status])}
    </span>
  );
}

function ResistanceDashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const { data: catalogBody } = useSuspenseQuery(catalogsQuery);
  const catalog = catalogBody.data;
  const markerFn = useServerFn(getMarkerSummary);

  const annualYears = catalog.periods.annual.map((p) => p.isoYear);
  const fourWeeks = catalog.periods.fourWeek;
  const year = search.isoYear ?? (search.kind === "four-week" ? (fourWeeks.at(-1)?.isoYear ?? 2024) : (annualYears.at(-1) ?? 2024));
  const weekOptions = fourWeeks.filter((p) => p.isoYear === year);
  const week = search.isoWeek ?? weekOptions.at(-1)?.isoWeek;

  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch }), replace: true });

  const params = calcParams(search, year, week);
  const key = ["aei", "api", search.kind, year, week, search.organism, search.antibiotic, search.ward, search.specimen];

  const summary = useQuery({
    queryKey: [...key, "summary"],
    queryFn: () => aeiApi<{ data: ApiEnvelope }>("/resistance/summary", params),
  });
  const trends = useQuery({
    queryKey: [...key, "trends"],
    queryFn: () => {
      const p = calcParams(search, year, week);
      // Trends move forward; start far enough back to end at the selected period,
      // but never before the first year that actually has data.
      const firstYear = Math.min(...annualYears, year);
      const startYear = search.kind === "annual" ? Math.max(year - 4, firstYear) : year;
      p.set("count", search.kind === "annual" ? String(year - startYear + 1) : "8");
      let startWeek = week;
      if (search.kind === "four-week" && week) {
        const back = week - 28; // 8 four-week windows ≈ 32 weeks back
        const earlier = fourWeeks.filter((f) => f.isoYear === year && f.isoWeek <= Math.max(1, week - 28));
        startWeek = (earlier[0] ?? fourWeeks.find((f) => f.isoYear === year))?.isoWeek;
        p.set("isoWeek", String(startWeek ?? week));
      }
      p.set("isoYear", String(search.kind === "annual" ? Math.max(1900, startYear) : year));
      return aeiApi<{ data: ApiEnvelope[]; direction: string; count: number }>("/resistance/trends", p);
    },
  });
  const breakdown = useQuery({
    queryKey: [...key, "breakdowns"],
    queryFn: () => aeiApi<{ data: ApiEnvelope }>("/resistance/breakdowns", params),
  });
  const forecast = useQuery({
    queryKey: [...key, "forecast"],
    queryFn: () => aeiApi<{ data: ForecastResponse }>("/forecast", params),
    enabled: Boolean(search.organism && search.antibiotic),
    staleTime: 60_000,
  });
  const markers = useQuery({
    queryKey: [...key, "markers"],
    queryFn: () =>
      markerFn({
        data: {
          period:
            search.kind === "annual"
              ? { kind: "annual" as const, isoYear: year }
              : { kind: "four-week" as const, isoYear: year, isoWeek: week ?? 1 },
          ...(search.organism ? { organisms: [search.organism] } : {}),
          ...(search.ward ? { wards: [search.ward] } : {}),
          ...(search.specimen ? { specimens: [search.specimen] } : {}),
        },
      }),
  });

  const selectCls = "max-w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

  const envelope = summary.data?.data;
  const results = envelope?.results ?? [];
  const breakdownResults = breakdown.data?.data?.results ?? [];

  // Trend chart data: one point per period, one series per organism/antibiotic pair.
  const trendEnvelopes = trends.data?.data ?? [];
  const seriesKeys = [...new Set(trendEnvelopes.flatMap((e) => e.results.map((r) => `${r.dimensions.organism} / ${r.dimensions.antibiotic}`)))].slice(0, 8);
  const chartData = trendEnvelopes.map((e) => {
    const p = e.period;
    const axis = p.kind === "annual" ? String(p.isoYear) : `${t("weekAxis")}${p.isoWeek}`;
    const label =
      p.kind === "annual"
        ? t("yearTooltip").replace("{year}", String(p.isoYear))
        : `${t("weekTooltip").replace("{week}", String(p.isoWeek)).replace("{year}", String(p.isoYear))} (${p.start.slice(0, 10)} – ${lastDay(p.endExclusive)})`;
    const point: Record<string, number | string | null> = { name: axis, label };
    for (const r of e.results) {
      const k = `${r.dimensions.organism} / ${r.dimensions.antibiotic}`;
      if (seriesKeys.includes(k)) point[k] = r.percentage === null ? null : Math.round(r.percentage * 100) / 100;
    }
    return point;
  });
  const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)", "var(--muted-foreground)", "var(--destructive)"];

  // Section title carries the selected period so readers know which week/year the chart leads up to.
  const selPeriod = envelope?.period;
  const trendPeriodLabel = selPeriod
    ? selPeriod.kind === "annual"
      ? t("yearTooltip").replace("{year}", String(selPeriod.isoYear))
      : t("weekTooltip").replace("{week}", String(selPeriod.isoWeek)).replace("{year}", String(selPeriod.isoYear))
    : null;

  const anyError = summary.error ?? trends.error ?? breakdown.error ?? markers.error;
  const anyLoading = summary.isPending || trends.isPending || breakdown.isPending || markers.isPending;

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-semibold">{t("resistance")}</h1>
      <p className="mb-4 font-mono text-xs text-muted-foreground">{t("provisional")}</p>

      <section aria-label={t("periodKind")} className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
        <label className="min-w-0 max-w-full space-y-1 text-sm">
          <div>{t("periodKind")}</div>
          <select className={selectCls} value={search.kind} onChange={(e) => setSearch({ kind: e.target.value as Search["kind"], isoYear: undefined, isoWeek: undefined })}>
            <option value="annual">{t("annual")}</option>
            <option value="four-week">{t("fourWeek")}</option>
          </select>
        </label>
        <label className="min-w-0 max-w-full space-y-1 text-sm">
          <div>{t("isoYear")}</div>
          <select className={selectCls} value={year} onChange={(e) => setSearch({ isoYear: Number(e.target.value), isoWeek: undefined })}>
            {(search.kind === "annual" ? annualYears : [...new Set(fourWeeks.map((f) => f.isoYear))]).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        {search.kind === "four-week" && (
          <label className="min-w-0 max-w-full space-y-1 text-sm">
            <div>{t("isoWeek")}</div>
            <select className={selectCls} value={week} onChange={(e) => setSearch({ isoWeek: Number(e.target.value) })}>
              {weekOptions.map((f) => (
                <option key={f.isoWeek} value={f.isoWeek}>W{f.isoWeek} ({f.start.slice(0, 10)})</option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-0 max-w-full space-y-1 text-sm">
          <div>{t("organism")}</div>
          <select className={selectCls} value={search.organism ?? ""} onChange={(e) => setSearch({ organism: e.target.value || undefined })}>
            <option value="">{t("allOption")}</option>
            {catalog.organisms.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="min-w-0 max-w-full space-y-1 text-sm">
          <div>{t("antibiotic")}</div>
          <select className={selectCls} value={search.antibiotic ?? ""} onChange={(e) => setSearch({ antibiotic: e.target.value || undefined })}>
            <option value="">{t("allOption")}</option>
            {catalog.antibiotics.map((a) => <option key={a.code} value={a.code}>{a.code} — {pickLabel(a, lang)}</option>)}
          </select>
        </label>
        <label className="min-w-0 max-w-full space-y-1 text-sm">
          <div>{t("ward")}</div>
          <select className={selectCls} value={search.ward ?? ""} onChange={(e) => setSearch({ ward: e.target.value || undefined })}>
            <option value="">{t("allOption")}</option>
            {catalog.wards.map((w) => <option key={w.code} value={w.code}>{pickLabel(w, lang)}</option>)}
          </select>
        </label>
        <label className="min-w-0 max-w-full space-y-1 text-sm">
          <div>{t("specimen")}</div>
          <select className={selectCls} value={search.specimen ?? ""} onChange={(e) => setSearch({ specimen: e.target.value || undefined })}>
            <option value="">{t("allOption")}</option>
            {catalog.specimens.map((sp) => <option key={sp.code} value={sp.code}>{pickLabel(sp, lang)}</option>)}
          </select>
        </label>
      </section>

      {anyError && (
        <p role="alert" className="mb-6 rounded-md border border-destructive bg-card p-4 text-sm text-destructive">{t("apiError")}</p>
      )}
      {anyLoading && !anyError && <p className="mb-6 font-mono text-sm text-muted-foreground">{t("loading")}</p>}
      {!anyLoading && !anyError && envelope?.status === "no-data" && (
        <p className="mb-6 rounded-md border border-border bg-muted p-4 text-sm">{t("noData")}</p>
      )}

      {envelope && (
        <div className="mb-2 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>{t("periodShown")}: {envelope.period.start.slice(0, 10)} – {envelope.period.endExclusive.slice(0, 10)}</span>
          {envelope.warnings.length > 0 && <WarningChips warnings={envelope.warnings} />}
        </div>
      )}

      <section aria-label={t("summary")} className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((r, i) => (
          <article key={i} className="rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">
              {r.dimensions.organism} <span className="font-mono text-xs text-muted-foreground">/ {r.dimensions.antibiotic}</span>
            </h2>
            <div className="mt-2 font-mono text-3xl tabular-nums">
              {r.percentage === null ? <span className="text-lg text-muted-foreground">{t("notReported")}</span> : `${r.percentage.toFixed(1)}%`}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
              <dt>{t("resistant")}</dt><dd className="text-right tabular-nums">{r.resistantCount}</dd>
              <dt>{t("susceptible")}</dt><dd className="text-right tabular-nums">{r.susceptibleCount}</dd>
              <dt>{t("eligible")}</dt><dd className="text-right tabular-nums">{r.eligibleDenominator}</dd>
            </dl>
            <div className="mt-2 space-y-1">
              <StatusChip status={r.dataQualityStatus} />
              {r.warnings.length > 0 && <WarningChips warnings={r.warnings} />}
            </div>
          </article>
        ))}
      </section>

      <section aria-label={trendPeriodLabel ? `${t("trend")} — ${trendPeriodLabel}` : t("trend")} className="mb-8 rounded-md border border-border bg-card p-4">
        <h2 className="mb-1 flex flex-wrap items-baseline gap-2 text-lg font-semibold">
          <span>{t("trend")}</span>
          {trendPeriodLabel && <span className="font-mono text-xs font-normal text-muted-foreground">{trendPeriodLabel}</span>}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {selPeriod
            ? `${t("periodCovers")} ${selPeriod.start.slice(0, 10)} ${t("periodTo")} ${lastDay(selPeriod.endExclusive)} ${t("inclusive")}`
            : t("trendNote")}
        </p>
        {trends.isPending ? (
          <p className="font-mono text-sm text-muted-foreground">{t("loading")}</p>
        ) : chartData.length === 0 || seriesKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin - 5)), (dataMax: number) => Math.min(100, Math.ceil(dataMax + 5))]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="%" />
                <Tooltip labelFormatter={(label, payload) => (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? String(label)} formatter={(value) => (value === null || value === undefined ? t("notReported") : `${value}%`)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesKeys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={chartColors[i % chartColors.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <ForecastSection {...(forecast.data ? { data: forecast.data.data } : {})} loading={forecast.isPending} error={Boolean(forecast.error)} retry={() => { void forecast.refetch(); }} selected={Boolean(search.organism && search.antibiotic)} catalog={catalog} />

      <section aria-label={t("markers")} className="mb-8 rounded-md border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("markers")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("markersNote")}</p>
        {markers.isPending ? (
          <p className="font-mono text-sm text-muted-foreground">{t("loading")}</p>
        ) : markers.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["esbl", "mrsa", "vre", "cpe"] as const).map((m) => {
              const c = markers.data.markers[m];
              return (
                <div key={m} className="rounded-md border border-border bg-muted p-3">
                  <div className="font-mono text-xs uppercase text-muted-foreground">{m}</div>
                  <div className="mt-1 font-mono text-xl tabular-nums">{c.positive}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {t("markerPositive")}: {c.positive} · {t("markerUnknown")}: {c.unknown} · {t("markerNegative")}: {c.negative}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section aria-label={t("breakdown")} className="space-y-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("breakdown")}</h2>
        {breakdown.data?.data && (
          <p className="text-sm">
            {t("periodCovers")}{" "}
            <strong>{breakdown.data.data.period.start.slice(0, 10)}</strong> {t("periodTo")}{" "}
            <strong>{lastDay(breakdown.data.data.period.endExclusive)}</strong> {t("inclusive")}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              ({breakdown.data.data.period.kind === "annual" ? `${t("annual")} ${breakdown.data.data.period.isoYear}` : `${t("fourWeek")} ${breakdown.data.data.period.isoYear}-W${breakdown.data.data.period.isoWeek}`})
            </span>
          </p>
        )}
        <RateHelp />
        {breakdown.isPending ? (
          <p className="font-mono text-sm text-muted-foreground">{t("loading")}</p>
        ) : breakdown.error ? (
          <ResultsUnavailable onRetry={() => { void breakdown.refetch(); }} />
        ) : (
          <BreakdownTable
            results={breakdownResults}
            catalog={catalog}
            renderWarnings={(r) => <WarningChips warnings={r.warnings} />}
          />
        )}
      </section>
    </AppShell>
  );
}
