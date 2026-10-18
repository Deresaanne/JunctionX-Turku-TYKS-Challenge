/** Provisional review signals, not a clinical diagnosis. See ANOMALIES.md. */
import statistics from 'jstat';
const { jStat } = statistics;
import { calculateResistance, MINIMUM_DENOMINATOR, resolvePeriod, type CalculationRequest, type Observation, type Period, type PeriodRequest } from './resistance';

export const ANOMALY_POLICY = { method: 'one-sided-fisher-exact-holm', alpha: 0.05, historicalPeriods: 3, minimumDenominator: MINIMUM_DENOMINATOR, denominator: 'S+R; I and missing/invalid/uninterpretable results excluded', clinicalStatus: 'provisional-review-signal' } as const;
export type AssessmentReason = 'unusual-increase' | 'no-increase' | 'small-current-sample' | 'insufficient-history' | 'missing-period' | 'incomplete-period' | 'data-quality' | 'unequal-windows' | 'overlapping-patients';
type Result = ReturnType<typeof calculateResistance>['results'][number];
export type Counts = { resistant: number; susceptible: number; intermediate: number; eligible: number; missing: number; invalid: number; uninterpretable: number; repeated: number; selectedPatients: number; eligiblePatients: number; rate: number | null; interval95: [number, number] | null };
export type Assessment = { id: string; dimensions: Result['dimensions']; period: Period; status: 'detected' | 'no-anomaly' | 'insufficient-data'; reason: AssessmentReason; overlappingPatients: number; current: Counts; historical: { period: Period; counts: Counts | null }[]; baseline: Counts | null; changePercentagePoints: number | null; pValue: number | null; adjustedPValue: number | null; confidenceStatus: 'review-signal' | 'no-signal' | 'not-assessable' };
export type AnomalyResponse = { status: 'anomalies-detected' | 'no-anomalies' | 'insufficient-data' | 'no-data'; period: Period; policy: typeof ANOMALY_POLICY; anomalies: Assessment[]; assessments: Assessment[]; testedGroups: number; insufficientGroups: number };

/** ISO fields from a Monday, without importing the API handler into the engine. */
function mondayPeriod(date: Date): PeriodRequest {
  const thursday = new Date(date); thursday.setUTCDate(thursday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const start = new Date(resolvePeriod({ kind: 'annual', isoYear }).start);
  return { kind: 'four-week', isoYear, isoWeek: Math.floor((date.getTime() - start.getTime()) / 604800000) + 1 };
}
export function anomalyPeriods(current: PeriodRequest): PeriodRequest[] {
  return Array.from({ length: 4 }, (_, i) => {
    if (current.kind === 'annual') return { kind: 'annual' as const, isoYear: current.isoYear - 3 + i };
    const date = new Date(resolvePeriod(current).start); date.setUTCDate(date.getUTCDate() - (3 - i) * 28);
    return mondayPeriod(date);
  });
}
const chooseLog = (n: number, k: number) => jStat.gammaln(n + 1) - jStat.gammaln(k + 1) - jStat.gammaln(n - k + 1);
/** Exact upper tail of the fixed-margin hypergeometric distribution; log-sum-exp avoids underflow. */
export function fisherIncrease(r: number, s: number, baselineR: number, baselineS: number): number {
  const draws = r + s, successes = r + baselineR, total = draws + baselineR + baselineS;
  if (!draws || total === draws) return 1;
  const hi = Math.min(draws, successes);
  let logSum = -Infinity;
  for (let k = r; k <= hi; k++) {
    const logP = chooseLog(successes, k) + chooseLog(total - successes, draws - k) - chooseLog(total, draws);
    const max = Math.max(logSum, logP);
    logSum = max + Math.log(Math.exp(logSum - max) + Math.exp(logP - max));
  }
  return Math.min(1, Math.exp(logSum));
}
export function holm(pValues: number[]): number[] {
  const sorted = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adjusted = Array<number>(pValues.length); let last = 0;
  sorted.forEach(({ p, i }, rank) => { last = Math.max(last, Math.min(1, p * (pValues.length - rank))); adjusted[i] = last; });
  return adjusted;
}
function interval(r: number, n: number): [number, number] | null {
  if (n < MINIMUM_DENOMINATOR) return null;
  const z = jStat.normal.inv(0.975, 0, 1), p = r / n, scale = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / scale;
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / scale;
  return [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100];
}
function counts(result: Result, patients: Map<string, string>): Counts {
  const unique = (ids: string[]) => new Set(ids.map(id => patients.get(id)).filter(p => p !== undefined)).size;
  return { resistant: result.resistantCount, susceptible: result.susceptibleCount, intermediate: result.intermediateCount, eligible: result.eligibleDenominator, missing: result.missingCount, invalid: result.invalidCount, uninterpretable: result.uninterpretableCount, repeated: result.repeatedIsolateCount, selectedPatients: unique(result.selectedIsolateIds), eligiblePatients: unique(result.denominatorIsolateIds), rate: result.percentage, interval95: interval(result.resistantCount, result.eligibleDenominator) };
}
const key = (r: Result) => JSON.stringify(['organism', 'antibiotic', 'ward', 'specimen'].map(d => r.dimensions[d as keyof Result['dimensions']] ?? null));
const duration = (p: Period) => new Date(p.endExclusive).getTime() - new Date(p.start).getTime();

/** Same engine, same filters, selection reset independently in each reporting period. */
export function assessAnomalies(observations: Observation[], requests: CalculationRequest[], coverage: { start: string | null; end: string | null }, today: string): AnomalyResponse {
  if (requests.length !== 4) throw new Error('Four consecutive periods required');
  const outputs = requests.map(request => calculateResistance(observations, request));
  const current = outputs.at(-1);
  if (!current) throw new Error('Current period required');
  const history = outputs.slice(0, 3);
  if (history.some((o, i) => o.period.endExclusive !== outputs[i + 1]?.period.start)) throw new Error('Consecutive non-overlapping periods required');
  const patients = new Map(observations.map(o => [o.isolateId, o.patientId]));
  const historyMaps = history.map(o => new Map(o.results.map(r => [key(r), r])));
  const assessments: Assessment[] = current.results.map(result => {
    const previous = historyMaps.map(m => m.get(key(result)));
    const historical = history.map((o, i) => ({ period: o.period, counts: previous[i] ? counts(previous[i], patients) : null }));
    const a: Assessment = { id: JSON.stringify([key(result), current.period.start]), dimensions: result.dimensions, period: current.period, status: 'insufficient-data', reason: 'insufficient-history', overlappingPatients: 0, current: counts(result, patients), historical, baseline: null, changePercentagePoints: null, pValue: null, adjustedPValue: null, confidenceStatus: 'not-assessable' };
    const all = [...previous, result];
    const patientPeriods = new Map<string, number>();
    for (const r of all) {
      if (!r) continue;
      const periodPatients = new Set(r.denominatorIsolateIds.map(id => patients.get(id)).filter((p): p is string => p !== undefined));
      periodPatients.forEach(p => patientPeriods.set(p, (patientPeriods.get(p) ?? 0) + 1));
    }
    a.overlappingPatients = [...patientPeriods.values()].filter(n => n > 1).length;
    // Coverage is a conservative observed-date envelope, not a claim of complete laboratory capture.
    if ([...history, current].some(o => !coverage.start || !coverage.end || o.period.start < coverage.start || o.period.endExclusive > today || new Date(o.period.endExclusive).getTime() - 86400000 > new Date(coverage.end).getTime())) { a.reason = 'incomplete-period'; return a; }
    if (history.some(o => duration(o.period) !== duration(current.period))) { a.reason = 'unequal-windows'; return a; }
    if (result.eligibleDenominator < MINIMUM_DENOMINATOR) { a.reason = 'small-current-sample'; return a; }
    if (previous.some(r => !r)) { a.reason = 'missing-period'; return a; }
    if (previous.some(r => r && r.eligibleDenominator < MINIMUM_DENOMINATOR)) return a;
    if (all.some(r => r && r.missingCount + r.invalidCount + r.uninterpretableCount > 0)) { a.reason = 'data-quality'; return a; }
    const seen = new Set<string>();
    for (const r of all) {
      if (!r) continue;
      const periodPatients = new Set(r.denominatorIsolateIds.map(id => patients.get(id)).filter((p): p is string => p !== undefined));
      if (periodPatients.size !== r.eligibleDenominator || [...periodPatients].some(p => seen.has(p))) { a.reason = 'overlapping-patients'; return a; }
      periodPatients.forEach(p => seen.add(p));
    }
    const baseline = historical.reduce<Counts>((b, h) => {
      if (h.counts) for (const k of ['resistant', 'susceptible', 'intermediate', 'eligible', 'missing', 'invalid', 'uninterpretable', 'repeated', 'selectedPatients', 'eligiblePatients'] as const) b[k] += h.counts[k];
      return b;
    }, { resistant: 0, susceptible: 0, intermediate: 0, eligible: 0, missing: 0, invalid: 0, uninterpretable: 0, repeated: 0, selectedPatients: 0, eligiblePatients: 0, rate: null, interval95: null });
    baseline.rate = baseline.resistant / baseline.eligible * 100;
    baseline.interval95 = interval(baseline.resistant, baseline.eligible);
    a.baseline = baseline; a.changePercentagePoints = (result.percentage ?? 0) - baseline.rate;
    a.pValue = fisherIncrease(result.resistantCount, result.susceptibleCount, baseline.resistant, baseline.susceptible);
    a.status = 'no-anomaly'; a.reason = 'no-increase'; a.confidenceStatus = 'no-signal';
    return a;
  });
  const tested = assessments.filter(a => a.pValue !== null);
  const adjusted = holm(tested.map(a => a.pValue ?? 1));
  tested.forEach((a, i) => {
    a.adjustedPValue = adjusted[i] ?? 1;
    if (a.adjustedPValue <= ANOMALY_POLICY.alpha && (a.changePercentagePoints ?? 0) > 0) { a.status = 'detected'; a.reason = 'unusual-increase'; a.confidenceStatus = 'review-signal'; }
  });
  const anomalies = assessments.filter(a => a.status === 'detected');
  return { status: anomalies.length ? 'anomalies-detected' : tested.length ? 'no-anomalies' : assessments.length ? 'insufficient-data' : 'no-data', period: current.period, policy: ANOMALY_POLICY, anomalies, assessments, testedGroups: tested.length, insufficientGroups: assessments.length - tested.length };
}
