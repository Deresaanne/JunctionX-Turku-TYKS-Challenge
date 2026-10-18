import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { ApiError, handleApi, isoFields, type ApiEndpoint, type ApiServices, type Catalog } from './api';
import { calculateResistance, resolvePeriod } from './resistance';
import { loadResistanceObservations } from './resistance.server';
import { buildForecast, forecastWeeks } from './forecast';

async function readCatalog(client: SupabaseClient<Database>): Promise<Catalog> {
  const { data: organismRows, error: organismError } = await client.rpc('aei_organism_catalog');
  if (organismError) throw organismError;
  const [antibiotics, wards, specimens, first, last] = await Promise.all([
    client.from('antibiotics').select('antibiotic_code,label_en,label_fi').order('antibiotic_code'),
    client.from('wards').select('ward_code,label_en,label_fi').order('ward_code'),
    client.from('specimen_types').select('specimen_code,label_en,label_fi').order('specimen_code'),
    client.from('cultures').select('sample_date').order('sample_date').limit(1),
    client.from('cultures').select('sample_date').order('sample_date',{ascending:false}).limit(1),
  ]);
  for (const response of [antibiotics,wards,specimens,first,last]) if (response.error) throw response.error;
  const start = first.data?.[0]?.sample_date ?? null;
  const end = last.data?.[0]?.sample_date ?? null;
  const annual: Catalog['periods']['annual'] = [];
  const fourWeek: Catalog['periods']['fourWeek'] = [];
  if (start && end) {
    const from = isoFields(new Date(start));
    const to = isoFields(new Date(end));
    for (let year=from.isoYear;year<=to.isoYear;year++) annual.push(resolvePeriod({kind:'annual',isoYear:year}));
    const monday = new Date(resolvePeriod({kind:'four-week',...from}).start);
    // Offer every available ISO-Monday start, not an invented fixed clinical block alignment.
    for (;monday.toISOString().slice(0,10)<=end;monday.setUTCDate(monday.getUTCDate()+7)) fourWeek.push(resolvePeriod({kind:'four-week',...isoFields(monday)}));
  }
  return {
    organisms:(organismRows ?? []).map(row=>row.organism),
    antibiotics:(antibiotics.data ?? []).map(a=>({code:a.antibiotic_code,label_en:a.label_en,label_fi:a.label_fi})),
    wards:(wards.data ?? []).map(a=>({code:a.ward_code,label_en:a.label_en,label_fi:a.label_fi})),
    specimens:(specimens.data ?? []).map(a=>({code:a.specimen_code,label_en:a.label_en,label_fi:a.label_fi})),
    periods:{annual,fourWeek},dateRange:{start,end},
  };
}
export async function serveApi(request: Request, endpoint: ApiEndpoint) {
  let client: SupabaseClient<Database> | undefined;
  let catalog: Catalog | undefined;
  const requireClient = () => {
    if (!client) throw new ApiError(401,'unauthorized','Bearer authentication required.');
    return client;
  };
  const services: ApiServices = {
    async authenticate(req) {
      const header = req.headers.get('authorization');
      if (!header) {
        // Public demo: anonymous visitors get read-only aggregate access (viewer). Imports still require admin/importer.
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        client = supabaseAdmin;
        return { roles: ['viewer'] };
      }
      if (!header?.startsWith('Bearer ') || header.length>8192) throw new ApiError(401,'unauthorized','Valid bearer authentication required.');
      const token = header.slice(7);
      if (token.split('.').length !== 3) throw new ApiError(401,'unauthorized','Valid bearer authentication required.');
      const url = process.env['SUPABASE_URL'];
      const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
      if (!url || !key) throw new Error('Service configuration unavailable');
      client = createClient<Database>(url,key,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>{
          const headers=new Headers(input instanceof Request ? input.headers : undefined);
          new Headers(init?.headers).forEach((value,name)=>headers.set(name,value));
          if (key.startsWith('sb_') && headers.get('Authorization')===`Bearer ${key}`) headers.delete('Authorization');
          headers.set('apikey',key);
          return fetch(input,{...init,headers});
        }},
      });
      const {data,error}=await client.auth.getUser(token);
      if (error || !data.user) throw new ApiError(401,'unauthorized','Invalid or expired bearer authentication.');
      const roles = await client.from('user_roles').select('role').eq('user_id',data.user.id);
      if (roles.error) throw new Error('Unable to verify roles');
      return {roles:(roles.data ?? []).map(row=>row.role)};
    },
    async catalogs() { catalog ??= await readCatalog(requireClient()); return catalog; },
    async calculate(requests) {
      const first = requests[0];
      const last = requests.at(-1);
      if (!first || !last) return [];
      const observations=await loadResistanceObservations(requireClient(),first,resolvePeriod(last.period).endExclusive);
      return requests.map(calculation=>calculateResistance(observations,calculation));
    },
    async forecast(request, coverage) {
      const today = new Date().toISOString().slice(0,10);
      const weeks = forecastWeeks(request,coverage,today);
      const first = weeks[0], last = weeks.at(-1);
      if (!first || !last) throw new Error('Forecast weeks required');
      const observations = await loadResistanceObservations(requireClient(),{...request,period:{kind:'four-week',isoYear:first.isoYear,isoWeek:first.isoWeek}},last.endExclusive);
      return buildForecast(observations,request,coverage,today);
    },
    async imports(limit,offset) {
      const {data,error}=await requireClient().from('import_runs')
        .select('id,dataset,status,rows_total,rows_inserted,rows_duplicate,rows_rejected,started_at,finished_at')
        .order('started_at',{ascending:false}).order('id').range(offset,offset+limit-1);
      if (error) throw error;
      // Do not expose file names, user IDs or stored validation messages that may contain source IDs.
      return (data ?? []).map(r=>({id:r.id,dataset:r.dataset,status:r.status,rowsRead:r.rows_total,rowsImported:r.rows_inserted,rowsUpdated:0,rowsSkipped:r.rows_duplicate,rowsRejected:r.rows_rejected,startedAt:r.started_at,finishedAt:r.finished_at}));
    },
    async status() {
      const {error}=await requireClient().from('wards').select('ward_code').limit(1);
      if (error) throw error;
    },
  };
  return handleApi(request,endpoint,services);
}