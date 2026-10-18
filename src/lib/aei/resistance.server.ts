import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { createImportStore } from './import-store.server';
import { calculateResistance, resolvePeriod, type CalculationRequest, type Observation } from './resistance';
export async function loadResistanceObservations(client: SupabaseClient<Database>, request: CalculationRequest, endExclusive?: string) {
  const period=resolvePeriod(request.period);
  const observations: Observation[] = [];
  let after: string | undefined;
  for (;;) {
    // Keep every isolate, including those without a matching antibiotic test.
    // The engine still decides first-isolate selection and result eligibility.
    let query=client.from('isolates').select('isolate_id,isolate_no,organism,cultures!inner(culture_id,patient_id,sample_date,ward_code,specimen_code,result),susceptibility_results(antibiotic_code,result)')
      .gte('cultures.sample_date',period.start).lt('cultures.sample_date',endExclusive ?? period.endExclusive).order('isolate_id').limit(1000);
    if (after) query=query.gt('isolate_id',after);
    if (request.organisms?.length) query=query.in('organism',request.organisms);
    if (request.wards?.length) query=query.in('cultures.ward_code',request.wards);
    if (request.specimens?.length) query=query.in('cultures.specimen_code',request.specimens);
    if (request.antibiotics.length) query=query.in('susceptibility_results.antibiotic_code',request.antibiotics);
    const {data,error}=await query;
    if (error) throw new Error('Unable to read resistance observations');
    for (const row of data ?? []) {
      const c=row.cultures;
      observations.push({isolateId:row.isolate_id,cultureId:c.culture_id,patientId:c.patient_id,organism:row.organism,sampleDate:c.sample_date,isolateNo:row.isolate_no,ward:c.ward_code,specimen:c.specimen_code,cultureResult:c.result,results:row.susceptibility_results.map(t=>({antibiotic:t.antibiotic_code,result:t.result}))});
    }
    if (!data || data.length<1000) break;
    after=data.at(-1)?.isolate_id;
    if (!after) break;
  }
  return observations;
}
export async function runResistance(client: SupabaseClient<Database>, request: CalculationRequest) {
  return calculateResistance(await loadResistanceObservations(client,request),request);
}

/** Aggregate lab-flag (ESBL/MRSA/VRE/CPE) counts only. Flags are the source of
 * truth: unknown stays unknown and is never derived from susceptibility results. */
export async function loadMarkerSummary(
  client: SupabaseClient<Database>,
  request: { period: CalculationRequest['period']; organisms?: string[]; wards?: string[]; specimens?: string[] },
) {
  const period = resolvePeriod(request.period);
  const cultures: { culture_id: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client.from('cultures').select('culture_id').gte('sample_date', period.start).lt('sample_date', period.endExclusive).order('culture_id').range(offset, offset + 999);
    if (request.wards?.length) query = query.in('ward_code', request.wards);
    if (request.specimens?.length) query = query.in('specimen_code', request.specimens);
    const { data, error } = await query;
    if (error) throw new Error('Unable to read culture observations');
    cultures.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const store = createImportStore(client);
  const isolates = await store.read('isolates', 'isolate_id,organism,esbl,mrsa,vre,cpe', 'culture_id', cultures.map((c) => c.culture_id));
  const count = () => ({ positive: 0, unknown: 0, negative: 0 });
  const markers = { esbl: count(), mrsa: count(), vre: count(), cpe: count() };
  let totalIsolates = 0;
  for (const row of isolates) {
    if (request.organisms?.length && !request.organisms.includes(String(row['organism']))) continue;
    totalIsolates++;
    for (const key of ['esbl', 'mrsa', 'vre', 'cpe'] as const) {
      const value = row[key];
      if (value === true) markers[key].positive++;
      else if (value === null || value === undefined) markers[key].unknown++;
      else markers[key].negative++;
    }
  }
  return { period, totalIsolates, markers };
}
