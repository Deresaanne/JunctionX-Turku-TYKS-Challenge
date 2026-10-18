/** Pure resistance calculations. Clinical policies are explicitly provisional. */
export const DEDUP_POLICY = 'provisional-first-patient-organism-period' as const;
export const MINIMUM_DENOMINATOR = 30;
export type PeriodRequest = { kind: 'annual'; isoYear: number } | { kind: 'four-week'; isoYear: number; isoWeek: number };
export type Period = PeriodRequest & { start: string; endExclusive: string };
export type Observation = { isolateId: string; patientId: string; organism: string; sampleDate: string; cultureId: string; isolateNo: number; ward: string; specimen: string; cultureResult: string; results: { antibiotic: string; result: string | null }[] };
export type Dimension = 'organism' | 'antibiotic' | 'ward' | 'specimen';
export type CalculationRequest = { period: PeriodRequest; deduplicationPolicy: typeof DEDUP_POLICY; organisms?: string[]; antibiotics: string[]; wards?: string[]; specimens?: string[]; groupBy?: Dimension[] };
const day = 86400000;
const isoStart = (year: number) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * day;
};
const dateText = (time: number) => new Date(time).toISOString().slice(0, 10);
export function resolvePeriod(request: PeriodRequest): Period {
  if (!Number.isInteger(request.isoYear) || request.isoYear < 1900 || request.isoYear > 2200) throw new Error('Invalid ISO year');
  const yearStart = isoStart(request.isoYear);
  if (request.kind === 'annual') return { ...request, start: dateText(yearStart), endExclusive: dateText(isoStart(request.isoYear + 1)) };
  const weeks = (isoStart(request.isoYear + 1) - yearStart) / (7 * day);
  if (!Number.isInteger(request.isoWeek) || request.isoWeek < 1 || request.isoWeek > weeks) throw new Error('Invalid ISO week for this year');
  const start = yearStart + (request.isoWeek - 1) * 7 * day;
  return { ...request, start: dateText(start), endExclusive: dateText(start + 28 * day) };
}
export function calculateResistance(observations: Observation[], request: CalculationRequest) {
  return calculateForPeriod(observations, request, resolvePeriod(request.period));
}
/** Same selection/eligibility engine, with a seven-day ISO-Monday reporting window. */
export function calculateWeeklyResistance(observations: Observation[], request: CalculationRequest) {
  const period = resolvePeriod(request.period);
  return calculateForPeriod(observations, request, { ...period, endExclusive: dateText(new Date(period.start).getTime() + 7 * day) });
}
function calculateForPeriod(observations: Observation[], request: CalculationRequest, period: Period) {
  if (request.deduplicationPolicy !== DEDUP_POLICY) throw new Error('Explicit provisional deduplication policy required');
  const dimensions = request.groupBy ?? ['organism', 'antibiotic', 'ward', 'specimen'];
  const matches = (filter: string[] | undefined, value: string) => !filter?.length || filter.includes(value);
  const cohort = observations.filter(o => o.sampleDate >= period.start && o.sampleDate < period.endExclusive && matches(request.organisms,o.organism) && matches(request.wards,o.ward) && matches(request.specimens,o.specimen));
  cohort.sort((a,b) => a.sampleDate.localeCompare(b.sampleDate) || a.cultureId.localeCompare(b.cultureId) || a.isolateNo-b.isolateNo || a.isolateId.localeCompare(b.isolateId));
  type Group = { dimensions: Partial<Record<Dimension,string>>; resistantCount: number; susceptibleCount: number; intermediateCount: number; missingCount: number; invalidCount: number; uninterpretableCount: number; repeatedIsolateCount: number; selectedIsolateIds: string[]; denominatorIsolateIds: string[] };
  const groups = new Map<string,Group>();
  const seen = new Set<string>();
  for (const o of cohort) {
    const validCulture = o.cultureResult === 'positive' || o.cultureResult === 'mixed_growth';
    const identity = JSON.stringify([o.patientId,o.organism]);
    const repeated = validCulture && seen.has(identity);
    // Selection precedes antibiotic-result eligibility, so later R/S results cannot replace an earlier I/missing result.
    if (validCulture) seen.add(identity);
    for (const antibiotic of [...new Set(request.antibiotics)]) {
      const labels = { organism:o.organism, antibiotic, ward:o.ward, specimen:o.specimen };
      const values = Object.fromEntries(dimensions.map(d => [d,labels[d]]));
      const key = JSON.stringify(values);
      let g = groups.get(key);
      if (!g) { g = { dimensions:values, resistantCount:0,susceptibleCount:0,intermediateCount:0,missingCount:0,invalidCount:0,uninterpretableCount:0,repeatedIsolateCount:0,selectedIsolateIds:[],denominatorIsolateIds:[] }; groups.set(key,g); }
      if (!validCulture) { g.uninterpretableCount++; continue; }
      if (repeated) { g.repeatedIsolateCount++; continue; }
      g.selectedIsolateIds.push(o.isolateId);
      const tests = o.results.filter(r => r.antibiotic === antibiotic);
      if (tests.length > 1) { g.invalidCount++; continue; }
      const result = tests[0]?.result;
      if (result == null || result === '') g.missingCount++;
      else if (result === 'I') g.intermediateCount++;
      else if (result === 'S' || result === 'R') { if (result === 'S') g.susceptibleCount++; else g.resistantCount++; g.denominatorIsolateIds.push(o.isolateId); }
      else g.invalidCount++;
    }
  }
  return {
    period, policy: { deduplication:DEDUP_POLICY, clinicalStatus:'provisional' as const, minimumDenominator:MINIMUM_DENOMINATOR, intermediateHandling:'excluded-from-S-plus-R-denominator', cohortFilters:'before-deduplication', annualBasis:'ISO-week-year', fourWeekBasis:'28-days-from-requested-ISO-Monday', mixedGrowth:'retain-supplied-organism-specific-isolates', markerAnalysis:'not-included' },
    results:[...groups.values()].map(g => {
      const eligibleDenominator=g.susceptibleCount+g.resistantCount;
      return { ...g, eligibleDenominator, selectedIsolateCount:g.selectedIsolateIds.length, percentage:eligibleDenominator>=MINIMUM_DENOMINATOR ? g.resistantCount/eligibleDenominator*100 : null, dataQualityStatus:eligibleDenominator===0 ? 'zero-denominator' : eligibleDenominator<MINIMUM_DENOMINATOR ? 'insufficient-data' : g.missingCount+g.invalidCount+g.uninterpretableCount>0 ? 'reportable-with-exclusions' : 'reportable' };
    }),
  };
}
