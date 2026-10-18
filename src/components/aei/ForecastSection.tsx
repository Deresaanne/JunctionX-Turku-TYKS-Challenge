import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useI18n, pickLabel, type Key } from '@/lib/aei/i18n';
import { FORECAST_POLICY, type ForecastResponse, type Model } from '@/lib/aei/forecast';
import type { CatalogData } from '@/lib/aei/api-client';
import { ResultsUnavailable } from './ResultStatus';

const modelLabels: Record<Model, Key> = { baseline: 'forecastBaseline', linear: 'forecastLinear', holt: 'forecastHolt' };
export function ForecastSection({ data, loading, error, retry, selected, catalog }: { data?: ForecastResponse; loading: boolean; error: boolean; retry: () => void; selected: boolean; catalog: CatalogData }) {
  const { t, lang } = useI18n();
  const rate = (n: number | null) => n === null ? t('notReported') : `${n.toFixed(1)}%`;
  return <section aria-label={t('forecastTitle')} className="mb-8 min-w-0 border-t border-border pt-6">
    <h2 className="text-lg font-semibold">{t('forecastTitle')}</h2>
    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('forecastSafety')}</p>
    {!selected ? <p className="mt-4 text-sm">{t('forecastSelect')}</p> : loading ? <p role="status" className="mt-4">{t('loading')}</p> : error ? <div className="mt-4"><ResultsUnavailable onRetry={retry}/></div> : data?.results.length ? data.results.map(r => {
      const antibiotic = catalog.antibiotics.find(a => a.code === r.dimensions.antibiotic);
      const chart = [...r.history.map(w => ({ name: `${t('weekAxis')}${w.isoWeek} / ${w.isoYear}`, date: w.start, observed: w.rate, forecast: w.start === r.latest.start ? w.rate : null })), { name: `${t('weekAxis')}${r.forecast.isoWeek} / ${r.forecast.isoYear}`, date: r.forecast.start, observed: null, forecast: r.forecast.rate }];
      const reason = r.reason === 'small' ? t('statusSmallCount').replace('{count}', String(r.latest.eligible)).replace('{minimum}', String(data.policy.minimumDenominator)) : r.reason === 'missing' ? t('forecastGap') : r.reason === 'quality' ? t('forecastQuality') : r.reason === 'incomplete' ? t('forecastIncomplete') : t('forecastHistory').replace('{weeks}', String(FORECAST_POLICY.minimumTrainingWeeks + FORECAST_POLICY.validationWeeks)).replace('{count}', String(r.consecutiveWeeks));
      return <div key={`${r.dimensions.organism}/${r.dimensions.antibiotic}`} className="mt-5 min-w-0 space-y-4">
        <h3 className="font-semibold">{r.dimensions.organism} · {antibiotic ? pickLabel(antibiotic, lang) : r.dimensions.antibiotic} ({r.dimensions.antibiotic})</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-sm text-muted-foreground">{t('forecastObserved')}</p><p className="font-mono text-2xl">{rate(r.latest.rate)}</p><p className="text-xs">{r.latest.start} · {t('colEligible')}: {r.latest.eligible} (S+R)</p></div>
          <div><p className="text-sm text-muted-foreground">{t('forecastNext')}</p><p className="font-mono text-2xl text-primary">{rate(r.forecast.rate)}</p><p className="text-xs">{r.forecast.start} · {t('weekAxis')}{r.forecast.isoWeek} / {r.forecast.isoYear}</p>{r.forecast.rate === null && <p role="status" className="mt-2 rounded-md border border-border bg-muted p-2 text-xs"><span aria-hidden="true">ℹ </span>{reason}</p>}</div>
          <div><p className="text-sm text-muted-foreground">{t('forecastChange')}</p><p className="font-mono text-2xl">{r.forecast.changePercentagePoints === null ? '—' : `${r.forecast.changePercentagePoints > 0 ? '+' : ''}${r.forecast.changePercentagePoints.toFixed(1)}`}</p></div>
        </div>
        {r.validation && <div className="space-y-1 text-sm"><p className="font-medium">{t(modelLabels[r.validation.selectedModel])} · {t('forecastError')}: {r.validation.mae.toFixed(2)}</p><p className="text-muted-foreground">{t('forecastValidation').replace('{count}', String(r.validation.validationWeeks))}</p><p className="text-muted-foreground">{t('forecastCaution')}</p></div>}
        {r.history.some(w => w.status !== 'usable') && <p className="text-sm text-muted-foreground">{t('forecastWeekWarnings').replace('{missing}', String(r.history.filter(w => w.status === 'missing' || w.status === 'incomplete').length)).replace('{small}', String(r.history.filter(w => w.status === 'small').length)).replace('{quality}', String(r.history.filter(w => w.status === 'quality').length))}</p>}
        <div className="h-64 min-w-0 w-full" role="img" aria-label={t('forecastTitle')}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}><CartesianGrid stroke="var(--border)"/><XAxis dataKey="name" minTickGap={40} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}/><YAxis domain={[0,100]} unit="%" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}/><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}/><Line name={t('forecastObserved')} dataKey="observed" stroke="var(--chart-1)" dot={false} connectNulls={false}/><Line name={t('forecastNext')} dataKey="forecast" stroke="var(--primary)" strokeDasharray="5 4" dot={{ r: 4 }} connectNulls={false}/></LineChart></ResponsiveContainer>
        </div>
        <details className="text-sm"><summary className="cursor-pointer py-2 font-medium">{t('forecastDetails')}</summary><p className="mb-3 max-w-3xl text-muted-foreground">{t('forecastMethod')}</p>
          {r.validation && <ul className="mb-3">{r.validation.candidates.map(c => <li key={c.model}>{t(modelLabels[c.model])}: {c.mae.toFixed(2)} {t('forecastError')}</li>)}</ul>}
          <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">{t('isoWeek')}</th><th>{t('colRate')}</th><th>{t('colEligible')}</th><th>R</th><th>S</th><th>{t('statusMissing')}</th><th>{t('statusInvalid')}</th><th>{t('statusUninterpretable')}</th></tr></thead><tbody>{r.history.map(w => <tr key={w.start} className="border-t border-border"><td className="p-2 whitespace-nowrap">{w.isoYear}-W{w.isoWeek} · {w.start}</td><td>{rate(w.rate)}</td><td>{w.eligible}</td><td>{w.resistant}</td><td>{w.susceptible}</td><td>{w.missing}</td><td>{w.invalid}</td><td>{w.uninterpretable}</td></tr>)}</tbody></table></div>
        </details>
      </div>;
    }) : <p className="mt-4 text-sm">{t('noData')}</p>}
  </section>;
}