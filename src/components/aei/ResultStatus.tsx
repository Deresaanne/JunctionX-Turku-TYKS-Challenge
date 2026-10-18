import { Check, Info, TriangleAlert, Circle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ApiResult } from "@/lib/aei/api-client";
import { useI18n, type Key } from "@/lib/aei/i18n";
import { MINIMUM_DENOMINATOR } from "@/lib/aei/resistance";
import { needsDataCheck, resultStatus, type ResultStatus } from "@/lib/aei/result-status";

const labels: Record<ResultStatus, Key> = {
  available: "statusAvailable", small: "statusSmall", check: "statusCheck", empty: "statusEmpty", unavailable: "statusUnavailable",
};
const icons = { available: Check, small: Info, check: TriangleAlert, empty: Circle, unavailable: RotateCw };

export function StatusExplanation({ status, result }: { status: ResultStatus; result?: ApiResult }) {
  const { t } = useI18n();
  const explanations: Record<ResultStatus, Key> = {
    available: "statusAvailableExplanation", small: "statusSmallExplanation", check: "statusCheckExplanation", empty: "statusEmptyExplanation", unavailable: "statusUnavailableExplanation",
  };
  return (
    <div className="space-y-2 text-sm text-foreground">
      {status === "small" && result && <p>{t("statusSmallCount").replace("{count}", String(result.eligibleDenominator)).replace("{minimum}", String(MINIMUM_DENOMINATOR))}</p>}
      <p>{t(explanations[status])}</p>
      {result && needsDataCheck(result) && (
        <div className="space-y-2">
          {status !== "check" && <p>{t("statusCheckExplanation")}</p>}
          <dl className="space-y-1 text-xs">
            {([
              ["statusMissing", result.missingCount], ["statusInvalid", result.invalidCount], ["statusUninterpretable", result.uninterpretableCount],
            ] as const).filter(([, count]) => count > 0).map(([key, count]) => (
              <div key={key} className="flex justify-between gap-4"><dt>{t(key)}</dt><dd className="font-mono tabular-nums">{count}</dd></div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export function ResultStatusLabel({ status, result }: { status?: ResultStatus; result?: ApiResult }) {
  const { t } = useI18n();
  const resolved = status ?? (result ? resultStatus(result) : "empty");
  const Icon = icons[resolved];
  return (
    <div className="w-36 max-w-full">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Icon aria-hidden="true" className={`size-4 shrink-0 ${resolved === "available" ? "text-primary" : "text-muted-foreground"}`} />
        <span>{t(labels[resolved])}</span>
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="link" size="sm" className="min-h-11 px-0 text-xs" aria-label={`${t("statusWhy")} ${t(labels[resolved])}${result ? ` — ${result.dimensions.organism}, ${result.dimensions.antibiotic}` : ""}`}>
            {t("statusWhy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-[calc(100vw-2rem)]" aria-label={t(labels[resolved])}>
          <p className="mb-2 text-sm font-semibold">{t(labels[resolved])}</p>
          <StatusExplanation status={resolved} {...(result ? { result } : {})} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ResultsUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return <div role="alert" className="space-y-2"><ResultStatusLabel status="unavailable" /><Button variant="outline" className="min-h-11" onClick={onRetry}><RotateCw aria-hidden="true" />{t("statusRetry")}</Button></div>;
}