import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { ApiResult, CatalogData } from "@/lib/aei/api-client";
import { useI18n, pickLabel } from "@/lib/aei/i18n";
import { Button } from "@/components/ui/button";
import { ResultStatusLabel, StatusExplanation } from "./ResultStatus";
import { matchesStatusFilter, resultStatus, type StatusFilter } from "@/lib/aei/result-status";

type Sort = "rateDesc" | "rateAsc" | "eligibleDesc" | "eligibleAsc";

/** Presentation-only view of breakdown API results. Never recalculates values. */
export function BreakdownTable({
  results,
  catalog,
  renderWarnings,
}: {
  results: ApiResult[];
  catalog: CatalogData;
  renderWarnings: (r: ApiResult) => ReactNode;
}) {
  const { t, lang } = useI18n();
  const [sort, setSort] = useState<Sort>("rateDesc");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<Set<number>>(new Set());

  const label = (list: { code: string; label_en: string; label_fi: string }[], code?: string, withCode = true) => {
    if (!code) return "—";
    const row = list.find((x) => x.code === code);
    if (!row) return code; // no lookup data: show the code itself, never invent a name
    return withCode ? `${pickLabel(row, lang)} (${code})` : pickLabel(row, lang);
  };

  const rows = useMemo(() => {
    const decorated = results.map((r, idx) => ({
      r,
      idx,
      antibiotic: label(catalog.antibiotics, r.dimensions.antibiotic),
      unit: label(catalog.wards, r.dimensions.ward),
      sample: label(catalog.specimens, r.dimensions.specimen, false),
    }));
    const needle = q.trim().toLowerCase();
    const searched = needle
      ? decorated.filter((d) => [d.r.dimensions.organism, d.antibiotic, d.unit, d.sample].join(" ").toLowerCase().includes(needle))
      : decorated;
    const filtered = searched.filter(({ r }) => matchesStatusFilter(r, statusFilter));
    const rate = (r: ApiResult) => r.percentage;
    return [...filtered].sort((a, b) => {
      if (sort === "eligibleDesc") return b.r.eligibleDenominator - a.r.eligibleDenominator;
      if (sort === "eligibleAsc") return a.r.eligibleDenominator - b.r.eligibleDenominator;
      const ra = rate(a.r), rb = rate(b.r);
      // Unreported rates always sort last; they are not 0%.
      if (ra === null && rb === null) return b.r.eligibleDenominator - a.r.eligibleDenominator;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return sort === "rateDesc" ? rb - ra : ra - rb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, catalog, q, sort, lang, statusFilter]);

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const inputCls = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-1 text-sm" style={{ minWidth: 200 }}>
          <div>{t("searchTable")}</div>
          <input type="search" className={`${inputCls} w-full`} value={q} placeholder={t("searchPlaceholder")} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <div>{t("sortBy")}</div>
          <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="rateDesc">{t("sortRateDesc")}</option>
            <option value="rateAsc">{t("sortRateAsc")}</option>
            <option value="eligibleDesc">{t("sortEligibleDesc")}</option>
            <option value="eligibleAsc">{t("sortEligibleAsc")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <div>{t("statusFilter")}</div>
          <select className={`${inputCls} min-h-11`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">{t("allOption")}</option>
            <option value="available">{t("statusAvailable")}</option>
            <option value="small">{t("statusSmall")}</option>
            <option value="check">{t("statusNeedsChecking")}</option>
          </select>
        </label>
        <span className="pb-2 font-mono text-xs text-muted-foreground">
          {rows.length} / {results.length} {t("rowsShown")}
        </span>
      </div>

      {rows.length === 0 ? (
        <ResultStatusLabel status="empty" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">{t("colBacterium")}</th>
                <th className="p-2">{t("colAntibiotic")}</th>
                <th className="p-2">{t("colUnit")}</th>
                <th className="p-2">{t("colSample")}</th>
                <th className="p-2" style={{ minWidth: 200 }}>{t("colRate")}</th>
                <th className="p-2 text-right">{t("colEligible")}</th>
                <th className="w-36 p-2">{t("status")}</th>
                <th className="p-2"><span className="sr-only">{t("colDetails")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, idx, antibiotic, unit, sample }) => {
                const isOpen = open.has(idx);
                return (
                  <Fragment key={idx}>
                    <tr className="border-t border-border align-top">
                      <td className="p-2 italic">{r.dimensions.organism}</td>
                      <td className="p-2">{antibiotic}</td>
                      <td className="p-2">{unit}</td>
                      <td className="p-2">{sample}</td>
                      <td className="p-2">
                        {r.percentage === null ? (
                          <span className="text-muted-foreground">{t("notReported")}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-right font-mono font-semibold tabular-nums">{r.percentage.toFixed(1)}%</span>
                            <div
                              role="meter"
                              aria-label={t("rateBarLabel")}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Number(r.percentage.toFixed(1))}
                              className="h-2.5 flex-1 overflow-hidden rounded-sm border border-border bg-muted"
                            >
                              <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, r.percentage))}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">{r.eligibleDenominator}</td>
                      <td className="p-2"><ResultStatusLabel result={r} /></td>
                      <td className="p-2">
                        <Button variant="link" size="sm" className="min-h-11 px-0 text-xs" aria-expanded={isOpen} aria-controls={`breakdown-details-${idx}`} onClick={() => toggle(idx)}>
                          {isOpen ? t("hideDetails") : t("showDetails")}
                        </Button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/40">
                        <td id={`breakdown-details-${idx}`} colSpan={8} className="p-3">
                          <div className="mb-3"><StatusExplanation status={resultStatus(r)} result={r} /></div>
                          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                            <dt className="text-muted-foreground">{t("colResistant")}</dt><dd className="font-mono tabular-nums">{r.resistantCount}</dd>
                            <dt className="text-muted-foreground">{t("colSusceptible")}</dt><dd className="font-mono tabular-nums">{r.susceptibleCount}</dd>
                            <dt className="text-muted-foreground">{t("colEligible")}</dt><dd className="font-mono tabular-nums">{r.eligibleDenominator}</dd>
                          </dl>
                          {r.warnings.length > 0 && <div className="mt-2">{renderWarnings(r)}</div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RateHelp() {
  const { t } = useI18n();
  return (
    <details className="rounded-md border border-border bg-muted/40 p-3 text-sm">
      <summary className="cursor-pointer font-medium">{t("helpTitle")}</summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>{t("helpFormula")}</p>
        <p>{t("helpSample")}</p>
        <p>{t("helpNoRisk")}</p>
      </div>
    </details>
  );
}
