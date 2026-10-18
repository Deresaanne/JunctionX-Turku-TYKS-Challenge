import { describe, expect, it } from 'vitest';
import { buildForecast, forecastWeeks, holt, predict, validateModels, weekFields, type Model } from './forecast';
import { calculateWeeklyResistance, DEDUP_POLICY, type CalculationRequest, type Observation } from './resistance';
export const forecastRequest: CalculationRequest = { period: { kind: 'four-week', isoYear: 2025, isoWeek: 1 }, deduplicationPolicy: DEDUP_POLICY, organisms: ['E. coli'], antibiotics: ['AMP'], specimens: ['urine'] };
export const coverage = { start: '2020-01-01', end: '2026-12-31' };
export function forecastFixture(rates = Array.from({ length: 12 }, (_, i) => 10 + i * 2), count = 100) {
  const weeks = forecastWeeks(forecastRequest, coverage, '2027-01-01').slice(-rates.length);
  return weeks.flatMap((w, i) => Array.from({ length: count }, (_, j): Observation => ({ isolateId: `${i}-${j}`, cultureId: `${i}-${j}`, patientId: `p-${j}`, isolateNo: 1, organism: 'E. coli', ward: 'ED', specimen: 'urine', sampleDate: w.start, cultureResult: 'positive', results: [{ antibiotic: 'AMP', result: j < (rates[i] ?? 0) * count / 100 ? 'R' : 'S' }] })));
}
describe('Weekly engine and date integrity', () => {
  it('uses seven days only, including the last day and excluding the following Monday', () => {
    const rows = forecastFixture().slice(-100);
    const first = rows[0]; if (!first) throw Error('fixture');
    first.sampleDate = '2025-01-26';
    rows.push({ ...first, isolateId: 'next', patientId: 'next', sampleDate: '2025-01-27' });
    const result = calculateWeeklyResistance(rows, { ...forecastRequest, period: { kind: 'four-week', isoYear: 2025, isoWeek: 4 } });
    expect(result.period).toMatchObject({ start: '2025-01-20', endExclusive: '2025-01-27' });
    expect(result.results[0]?.eligibleDenominator).toBe(100);
  });
  it('crosses ISO years with adjacent non-overlapping weekly boundaries', () => {
    expect(weekFields('2024-12-30')).toEqual({ isoYear: 2025, isoWeek: 1 });
    const weeks = forecastWeeks(forecastRequest, coverage, '2027-01-01');
    weeks.slice(1).forEach((w, i) => expect(weeks[i]?.endExclusive).toBe(w.start));
    expect(weeks.at(-1)).toMatchObject({ start: '2025-01-20', endExclusive: '2025-01-27' });
  });
  it('excludes the incomplete latest week and all future observations', () => {
    expect(forecastWeeks(forecastRequest, { ...coverage, end: '2025-01-22' }, '2027-01-01').at(-1)?.endExclusive).toBe('2025-01-20');
    expect(forecastWeeks(forecastRequest, coverage, '2025-01-14').at(-1)?.endExclusive).toBe('2025-01-13');
  });
  it('retains first-isolate selection before I/missing eligibility and resets per week', () => {
    const rows = forecastFixture(); const first = rows.at(-1); if (!first) throw Error('fixture');
    first.results = [{ antibiotic: 'AMP', result: 'I' }];
    rows.push({ ...first, isolateId: 'later', sampleDate: '2025-01-21', results: [{ antibiotic: 'AMP', result: 'S' }] });
    const result = buildForecast(rows, forecastRequest, coverage, '2027-01-01').results[0];
    expect(result?.latest).toMatchObject({ eligible: 99, intermediate: 1, repeatsExcluded: 1 });
    expect(result?.history.at(-2)?.eligible).toBe(100);
  });
  it('applies all cohort filters without mixing bacteria or antibiotics', () => {
    const rows = forecastFixture(); const first = rows[0]; if (!first) throw Error('fixture');
    rows.push({ ...first, isolateId: 'other', organism: 'Other' }, { ...first, isolateId: 'blood', specimen: 'blood' }, { ...first, isolateId: 'ward', ward: 'ICU' });
    const result = buildForecast(rows, { ...forecastRequest, wards: ['ED'] }, coverage, '2027-01-01');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.history.slice(-12).every(w => w.eligible === 100)).toBe(true);
  });
});
describe('Forecasts and temporal validation', () => {
  it('linear trend predicts the next week and wins measured validation', () => {
    const v = validateModels(Array.from({ length: 12 }, (_, i) => 10 + 2 * i));
    expect(v?.selectedModel).toBe('linear'); expect(v?.prediction).toBeCloseTo(34, 10); expect(v?.mae).toBeCloseTo(0, 10);
    expect(v?.candidates[0]?.mae).toBe(2);
  });
  it('stable series selects baseline on tied scores', () => {
    const v = validateModels(Array(12).fill(20));
    expect(v?.selectedModel).toBe('baseline'); expect(v?.prediction).toBe(20); expect(v?.mae).toBe(0);
  });
  it('Holt implements additive level/trend smoothing', () => expect(holt([10,12,14,16],0.5,0.5)).toBe(18));
  it.each(['baseline','linear','holt'] as Model[])('scores %s from earlier data only, with concrete outer-fold errors', model => {
    const values = [10,11,12,13,15,14,18,16,17,19,20,21];
    const candidate = validateModels(values)?.candidates.find(c => c.model === model);
    expect(candidate?.folds.map(f => f.predicted)).toEqual(values.slice(8).map((_, i) => predict(model, values.slice(0,8+i))));
    const changed = [...values]; changed[11] = 90;
    expect(validateModels(changed)?.candidates.find(c => c.model === model)?.folds[0]?.predicted).toBe(candidate?.folds[0]?.predicted);
    expect(candidate?.mae).toBeCloseTo((candidate?.folds ?? []).reduce((s,f) => s+Math.abs(f.actual-f.predicted),0)/4,10);
  });
  it('bounds deployed and validation predictions to valid percentages', () => {
    expect(predict('linear',[60,70,80,90,100])).toBe(100);
    expect(predict('linear',[40,30,20,10,0])).toBe(0);
  });
  it('requires at least 8 training and 4 validation weeks', () => {
    expect(validateModels(Array(11).fill(20))).toBeNull(); expect(validateModels(Array(12).fill(20))?.trainingWeeks).toBe(8);
  });
  it('produces a real aggregate forecast with recurring patients, without inferential tests', () => {
    const result = buildForecast(forecastFixture(),forecastRequest,coverage,'2027-01-01');
    expect(result.results[0]).toMatchObject({ status:'forecast-available',consecutiveWeeks:12,latest:{rate:32,eligible:100},forecast:{rate:34,changePercentagePoints:2} });
    expect(JSON.stringify(result)).not.toMatch(/patientId|isolateId|cultureId|pValue/);
  });
  it('preserves date gaps, never bridges an absent week or treats it as zero', () => {
    const rows = forecastFixture().filter(r => r.sampleDate !== '2024-12-30');
    const r = buildForecast(rows,forecastRequest,coverage,'2027-01-01').results[0];
    expect(r?.consecutiveWeeks).toBe(3); expect(r?.forecast.rate).toBeNull();
    expect(r?.history.find(w => w.start==='2024-12-30')).toMatchObject({status:'missing',rate:null});
  });
  it('29 eligible results withhold both observed percentage and forecast; 30 is reportable', () => {
    const a = buildForecast(forecastFixture(Array(12).fill(0),29),forecastRequest,coverage,'2027-01-01').results[0];
    expect(a).toMatchObject({reason:'small',latest:{eligible:29,rate:null},forecast:{rate:null}});
    expect(buildForecast(forecastFixture(Array(12).fill(0),30),forecastRequest,coverage,'2027-01-01').results[0]?.forecast.rate).toBe(0);
  });
  it.each([null,'X'])('missing or invalid latest results are excluded and block forecasting: %s', result => {
    const rows=forecastFixture();const first=rows.at(-1);if(!first)throw Error('fixture');first.results=[{antibiotic:'AMP',result}];
    const r=buildForecast(rows,forecastRequest,coverage,'2027-01-01').results[0];
    expect(r?.reason).toBe('quality');expect(r?.latest.eligible).toBe(99);expect(r?.forecast.rate).toBeNull();
  });
  it('an absent latest week gives a specific reason, no stale forecast', () => {
    const rows=forecastFixture().filter(r=>r.sampleDate!=='2025-01-20');
    expect(buildForecast(rows,forecastRequest,coverage,'2027-01-01').results[0]).toMatchObject({reason:'missing',latest:{rate:null},forecast:{rate:null}});
  });
  it('empty records return no data; incomplete coverage is not invented', () => {
    expect(buildForecast([],forecastRequest,coverage,'2027-01-01')).toMatchObject({status:'no-data',results:[]});
    expect(buildForecast(forecastFixture(),forecastRequest,{start:null,end:null},'2027-01-01').results[0]?.forecast.rate).toBeNull();
  });
});