import { linearRegression, linearRegressionLine } from 'simple-statistics';
import { calculateWeeklyResistance, MINIMUM_DENOMINATOR, resolvePeriod, type CalculationRequest, type Observation } from './resistance';

const WEEK = 604800000;
export const FORECAST_POLICY = { minimumDenominator: MINIMUM_DENOMINATOR, lookbackWeeks: 52, minimumTrainingWeeks: 8, validationWeeks: 4, denominator: 'R / (S + R) × 100', deduplication: 'first patient × organism within each week; cohort filters before selection', validation: 'expanding-window one-step-ahead MAE; last four weeks held out', clinicalStatus: 'provisional' } as const;
export type Model = 'baseline' | 'linear' | 'holt';
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const date = (time: number) => new Date(time).toISOString().slice(0, 10);
export function weekFields(start: string) {
  const d = new Date(start + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3);
  const isoYear = d.getUTCFullYear();
  return { isoYear, isoWeek: Math.floor((new Date(start).getTime() - new Date(resolvePeriod({ kind: 'annual', isoYear }).start).getTime()) / WEEK) + 1 };
}
/** Cap at the last fully covered week, never train on partial or future weeks. */
export function forecastWeeks(request: CalculationRequest, coverage: { start: string | null; end: string | null }, today: string) {
  const selectedEnd = new Date(resolvePeriod(request.period).endExclusive).getTime();
  const cap = Math.min(selectedEnd, new Date(today).getTime(), coverage.end ? new Date(coverage.end).getTime() + 86400000 : new Date(today).getTime());
  const d = new Date(cap);
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * 86400000;
  return Array.from({ length: FORECAST_POLICY.lookbackWeeks }, (_, i) => {
    const start = date(monday - (FORECAST_POLICY.lookbackWeeks - i) * WEEK);
    return { start, endExclusive: date(new Date(start).getTime() + WEEK), ...weekFields(start) };
  });
}
export function holt(values: number[], alpha: number, beta: number) {
  const first = values[0], second = values[1];
  if (first === undefined || second === undefined) throw new Error('Two training observations required');
  let level = first, trend = second - first;
  for (let i = 1; i < values.length; i++) {
    const value = values[i];
    if (value === undefined) continue;
    const previous = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - previous) + (1 - beta) * trend;
  }
  return clamp(level + trend);
}
const grid = [0.2, 0.5, 0.8];
export function tuneHolt(values: number[]) {
  let best = { alpha: 0.2, beta: 0.2, error: Infinity };
  for (const alpha of grid) for (const beta of grid) {
    const errors: number[] = [];
    for (let i = 4; i < values.length; i++) {
      const actual = values[i];
      if (actual !== undefined) errors.push(Math.abs(holt(values.slice(0, i), alpha, beta) - actual));
    }
    const error = errors.reduce((a, b) => a + b, 0) / errors.length;
    if (error < best.error) best = { alpha, beta, error };
  }
  return { alpha: best.alpha, beta: best.beta };
}
export function predict(model: Model, values: number[]) {
  const last = values.at(-1);
  if (last === undefined) throw new Error('Training history required');
  if (model === 'baseline') return last;
  if (model === 'linear') return clamp(linearRegressionLine(linearRegression(values.map((y, x) => [x, y])))(values.length));
  const { alpha, beta } = tuneHolt(values);
  return holt(values, alpha, beta);
}
export function validateModels(values: number[]) {
  if (values.length < FORECAST_POLICY.minimumTrainingWeeks + FORECAST_POLICY.validationWeeks) return null;
  const start = values.length - FORECAST_POLICY.validationWeeks;
  const candidates = (['baseline', 'linear', 'holt'] as Model[]).map(model => {
    const folds = values.slice(start).map((actual, i) => ({ actual, predicted: predict(model, values.slice(0, start + i)) }));
    return { model, mae: folds.reduce((sum, f) => sum + Math.abs(f.actual - f.predicted), 0) / folds.length, folds };
  });
  const winner = candidates.reduce((a, b) => b.mae < a.mae - 1e-10 ? b : a);
  return { selectedModel: winner.model, mae: winner.mae, candidates, validationWeeks: FORECAST_POLICY.validationWeeks, trainingWeeks: start, prediction: predict(winner.model, values), holtParameters: tuneHolt(values) };
}
export function buildForecast(observations: Observation[], request: CalculationRequest, coverage: { start: string | null; end: string | null }, today: string) {
  const weeks = forecastWeeks(request, coverage, today);
  const outputs = weeks.map(w => calculateWeeklyResistance(observations, { ...request, period: { kind: 'four-week', isoYear: w.isoYear, isoWeek: w.isoWeek }, groupBy: ['organism', 'antibiotic'] }));
  const keys = [...new Set(outputs.flatMap(o => o.results.map(r => JSON.stringify(r.dimensions))))];
  const results = keys.map(key => {
    const history = outputs.map((output, i) => {
      const w = weeks[i];
      if (!w) throw new Error('Week required');
      const r = output.results.find(r => JSON.stringify(r.dimensions) === key);
      const complete = Boolean(coverage.start && coverage.end && w.start >= coverage.start && w.endExclusive <= date(new Date(coverage.end).getTime() + 86400000));
      const quality = (r?.missingCount ?? 0) + (r?.invalidCount ?? 0) + (r?.uninterpretableCount ?? 0);
      const status = !complete ? 'incomplete' : !r || r.eligibleDenominator === 0 ? 'missing' : r.eligibleDenominator < MINIMUM_DENOMINATOR ? 'small' : quality ? 'quality' : 'usable';
      return { ...w, status, rate: r?.percentage ?? null, resistant: r?.resistantCount ?? 0, susceptible: r?.susceptibleCount ?? 0, intermediate: r?.intermediateCount ?? 0, eligible: r?.eligibleDenominator ?? 0, missing: r?.missingCount ?? 0, invalid: r?.invalidCount ?? 0, uninterpretable: r?.uninterpretableCount ?? 0, repeatsExcluded: r?.repeatedIsolateCount ?? 0 };
    });
    const latest = history.at(-1);
    if (!latest) throw new Error('Latest week required');
    // Never bridge a date gap, excluded week, or non-reportable latest week.
    const consecutive: number[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const w = history[i];
      if (!w || w.status !== 'usable' || w.rate === null) break;
      consecutive.unshift(w.rate);
    }
    const validation = validateModels(consecutive);
    const reason = latest.status !== 'usable' ? latest.status : validation ? 'ready' : 'history';
    const nextStart = latest.endExclusive;
    return { dimensions: JSON.parse(key) as { organism: string; antibiotic: string }, status: validation ? 'forecast-available' : 'insufficient-data', reason, latest, history, consecutiveWeeks: consecutive.length, validation, forecast: { start: nextStart, endExclusive: date(new Date(nextStart).getTime() + WEEK), ...weekFields(nextStart), rate: validation?.prediction ?? null, changePercentagePoints: validation ? validation.prediction - (latest.rate ?? 0) : null } };
  });
  return { policy: FORECAST_POLICY, status: results.length ? 'ok' : 'no-data', results };
}
export type ForecastResponse = ReturnType<typeof buildForecast>;