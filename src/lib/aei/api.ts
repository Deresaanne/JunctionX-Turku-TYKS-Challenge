import { z } from 'zod';
import { DEDUP_POLICY, resolvePeriod, type CalculationRequest, type PeriodRequest, type calculateResistance } from './resistance';
import type { ForecastResponse } from './forecast';

export type ApiEndpoint = 'health' | 'catalogs' | 'summary' | 'trends' | 'breakdowns' | 'quality' | 'imports' | 'anomalies' | 'forecast';
export type Catalog = { organisms: string[]; antibiotics: { code: string; label_en: string; label_fi: string }[]; wards: { code: string; label_en: string; label_fi: string }[]; specimens: { code: string; label_en: string; label_fi: string }[]; periods: { annual: ReturnType<typeof resolvePeriod>[]; fourWeek: ReturnType<typeof resolvePeriod>[] }; dateRange: { start: string | null; end: string | null } };
export type EngineOutput = ReturnType<typeof calculateResistance>;
export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export type ApiServices = {
  authenticate: (request: Request) => Promise<{ roles: string[] }>;
  catalogs: () => Promise<Catalog>;
  calculate: (requests: CalculationRequest[]) => Promise<EngineOutput[]>;
  imports: (limit: number, offset: number) => Promise<unknown[]>;
  status: () => Promise<void>;
  forecast?: (request: CalculationRequest, coverage: Catalog['dateRange']) => Promise<ForecastResponse>;
};
const number = (min: number, max: number) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
const filter = z.array(z.string().trim().min(1).max(150)).min(1).max(100).optional();
const querySchema = z.object({
  period: z.enum(['annual', 'four-week']), isoYear: number(1900, 2200), isoWeek: number(1, 53).optional(),
  policy: z.literal(DEDUP_POLICY), organism: filter, antibiotic: filter, ward: filter, specimen: filter,
  groupBy: z.array(z.enum(['organism', 'antibiotic', 'ward', 'specimen'])).min(2).max(4).optional(),
  count: number(1, 13).optional(),
}).strict();
export function parseCalculationQuery(params: URLSearchParams, endpoint: ApiEndpoint) {
  const allowed = new Set(['period','isoYear','isoWeek','policy','organism','antibiotic','ward','specimen', ...(endpoint === 'breakdowns' ? ['groupBy'] : []), ...(endpoint === 'trends' ? ['count'] : [])]);
  const input: Record<string, unknown> = {};
  const multi = new Set(['organism','antibiotic','ward','specimen','groupBy']);
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key)) throw new ApiError(400, 'invalid_query', `Unknown parameter: ${key}`);
    const values = params.getAll(key);
    if (!multi.has(key) && values.length !== 1) throw new ApiError(400, 'invalid_query', `Repeated parameter: ${key}`);
    input[key] = multi.has(key) ? values : values[0];
  }
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, 'invalid_query', 'Invalid filters, period, or missing explicit provisional policy acknowledgment.');
  const q = parsed.data;
  if ((q.period === 'annual' && q.isoWeek !== undefined) || (q.period === 'four-week' && q.isoWeek === undefined)) throw new ApiError(400, 'invalid_period', 'isoWeek is required only for four-week periods.');
  if (q.groupBy && (!q.groupBy.includes('organism') || !q.groupBy.includes('antibiotic') || new Set(q.groupBy).size !== q.groupBy.length)) throw new ApiError(400, 'invalid_dimensions', 'Keep organism and antibiotic distinct; dimensions must be unique.');
  if (q.period === 'annual' && (q.count ?? 1) > 5) throw new ApiError(400, 'invalid_period', 'Annual trends are limited to five periods.');
  const period: PeriodRequest = q.period === 'annual' ? { kind: 'annual', isoYear: q.isoYear } : { kind: 'four-week', isoYear: q.isoYear, isoWeek: q.isoWeek ?? 0 };
  try { resolvePeriod(period); } catch { throw new ApiError(400, 'invalid_period', 'Invalid ISO year/week combination.'); }
  return { q, period };
}
export function isoFields(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7);
  const isoYear = d.getUTCFullYear();
  const start = new Date(resolvePeriod({kind:'annual', isoYear}).start);
  return { isoYear, isoWeek: Math.floor((date.getTime() - start.getTime()) / 604800000) + 1 };
}
export function trendPeriods(first: PeriodRequest, count: number): PeriodRequest[] {
  return Array.from({length: count}, (_, index) => {
    if (first.kind === 'annual') return {kind:'annual' as const, isoYear:first.isoYear + index};
    const date = new Date(resolvePeriod(first).start);
    date.setUTCDate(date.getUTCDate() + index * 28);
    return {kind:'four-week' as const, ...isoFields(date)};
  });
}
export function aggregateResponse(output: EngineOutput) {
  return {
    period: output.period, policy: output.policy,
    status: output.results.length ? 'ok' : 'no-data',
    warnings: ['provisional-clinical-policy', ...(output.results.length ? [] : ['no-data'])],
    results: output.results.map(({ selectedIsolateIds: _selected, denominatorIsolateIds: _denominator, ...result }) => ({
      ...result, period: output.period,
      warnings: [
        ...(result.eligibleDenominator < 30 ? [result.dataQualityStatus === 'zero-denominator' ? 'zero-denominator' : 'insufficient-sample'] : []),
        ...(result.intermediateCount ? ['intermediate-excluded'] : []),
        ...(result.missingCount ? ['missing-results'] : []), ...(result.invalidCount ? ['invalid-results'] : []),
        ...(result.uninterpretableCount ? ['uninterpretable-results'] : []), ...(result.repeatedIsolateCount ? ['repeated-isolates-excluded'] : []),
      ],
    })),
  };
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'} });
export async function handleApi(request: Request, endpoint: ApiEndpoint, services: ApiServices): Promise<Response> {
  try {
    if (request.method !== 'GET') return json({error:{code:'method_not_allowed',message:'Read-only endpoint.'}},405);
    const params = new URL(request.url).searchParams;
    if (endpoint === 'health') {
      if (params.size) throw new ApiError(400,'invalid_query','Health takes no parameters.');
      return json({application:'AEI',apiVersion:1,status:'ok',clinicalPolicy:'provisional'});
    }
    const { roles } = await services.authenticate(request);
    if (!roles.some(role => ['admin','importer','viewer'].includes(role))) throw new ApiError(403,'forbidden','A data-access role is required.');
    if (endpoint === 'anomalies') return json({error:{code:'retired',message:'Replaced by weekly resistance forecasting.'}},410);
    if (endpoint === 'imports') {
      if (!roles.some(role => ['admin','importer'].includes(role))) throw new ApiError(403,'forbidden','Admin or importer role required.');
      for (const key of params.keys()) if (!['limit','offset'].includes(key) || params.getAll(key).length !== 1) throw new ApiError(400,'invalid_query','Invalid pagination parameter.');
      const page = z.object({limit:number(1,100),offset:number(0,1000000)}).safeParse({limit:params.get('limit') ?? '20', offset:params.get('offset') ?? '0'});
      if (!page.success) throw new ApiError(400,'invalid_query','Invalid pagination bounds.');
      return json({data:await services.imports(page.data.limit,page.data.offset),pagination:page.data});
    }
    if (endpoint === 'catalogs') {
      if (params.size) throw new ApiError(400,'invalid_query','Catalogs takes no parameters.');
      await services.status();
      return json({data:await services.catalogs(),status:'ok',clinicalPolicy:'provisional'});
    }
    const {q,period} = parseCalculationQuery(params,endpoint);
    const catalog = await services.catalogs();
    for (const [name, values, available] of [
      ['organism',q.organism,catalog.organisms], ['antibiotic',q.antibiotic,catalog.antibiotics.map(a=>a.code)],
      ['ward',q.ward,catalog.wards.map(a=>a.code)], ['specimen',q.specimen,catalog.specimens.map(a=>a.code)],
    ] as const) {
      if (values?.some(v => !available.includes(v))) throw new ApiError(400,'unknown_filter',`Unknown ${name} filter.`);
    }
    const periods = endpoint === 'trends' ? trendPeriods(period,q.count ?? 1) : [period];
    if (periods.some(p => p.isoYear < 1900)) throw new ApiError(400,'invalid_period','Comparison exceeds supported ISO years.');
    if (periods.some(p => p.isoYear > 2200)) throw new ApiError(400,'invalid_period','Trend exceeds supported ISO years.');
    const requests: CalculationRequest[] = periods.map(p => ({
      period:p,deduplicationPolicy:DEDUP_POLICY,antibiotics:q.antibiotic ?? catalog.antibiotics.map(a=>a.code),
      ...(q.organism ? {organisms:q.organism} : {}), ...(q.ward ? {wards:q.ward} : {}), ...(q.specimen ? {specimens:q.specimen} : {}),
      groupBy:endpoint === 'breakdowns' ? q.groupBy ?? ['organism','antibiotic','ward','specimen'] : ['organism','antibiotic'],
    }));
    if (endpoint === 'forecast') {
      const forecastRequest = requests[0];
      if (!services.forecast || !forecastRequest) throw new Error('Forecast service unavailable');
      if (q.organism?.length !== 1 || q.antibiotic?.length !== 1) throw new ApiError(400,'invalid_filters','Select one bacterium and one antibiotic for forecasting.');
      if (period.isoYear < 1901) throw new ApiError(400,'invalid_period','History exceeds supported ISO years.');
      return json({data:await services.forecast(forecastRequest,catalog.dateRange)});
    }
    const outputs = await services.calculate(requests);
    return json(endpoint === 'trends' ? {data:outputs.map(aggregateResponse),direction:'forward',count:outputs.length} : {data:outputs[0] ? aggregateResponse(outputs[0]) : null});
  } catch (error) {
    if (error instanceof ApiError) return json({error:{code:error.code,message:error.message}},error.status);
    console.error('AEI API request failed');
    return json({error:{code:'service_unavailable',message:'Unable to read surveillance data. Try again later.'}},503);
  }
}