import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { loadResistanceObservations } from './resistance.server';
import { calculateResistance, DEDUP_POLICY } from './resistance';

describe('Optimized reader preserves selection before eligibility', () => {
  it('keeps an earlier isolate with no test instead of replacing it with a later R', async () => {
    const rows = [1,2].map(n=>({isolate_id:`i${n}`,isolate_no:1,organism:'E. coli',cultures:{culture_id:`c${n}`,patient_id:'p1',sample_date:`2024-06-0${n}`,ward_code:'W',specimen_code:'S',result:'positive'},susceptibility_results:n===1?[]:[{antibiotic_code:'AMP',result:'R'}]}));
    const query = { select:vi.fn(),gte:vi.fn(),lt:vi.fn(),order:vi.fn(),limit:vi.fn(),in:vi.fn(),gt:vi.fn(),then: (resolve: (v: unknown)=>unknown)=>Promise.resolve({data:rows,error:null}).then(resolve) };
    for (const key of ['select','gte','lt','order','limit','in','gt'] as const) query[key].mockReturnValue(query);
    const client={from:vi.fn(()=>query)} as unknown as SupabaseClient<Database>;
    const request={period:{kind:'annual' as const,isoYear:2024},deduplicationPolicy:DEDUP_POLICY,antibiotics:['AMP'],organisms:['E. coli'],wards:['W'],specimens:['S']};
    const observations=await loadResistanceObservations(client,request);
    expect(observations).toHaveLength(2);
    expect(observations[0]?.results).toEqual([]);
    expect(query.in).toHaveBeenCalledWith('susceptibility_results.antibiotic_code',['AMP']);
    const result=calculateResistance(observations,request).results[0];
    expect(result).toMatchObject({missingCount:1,repeatedIsolateCount:1,resistantCount:0,eligibleDenominator:0,percentage:null});
  });
});