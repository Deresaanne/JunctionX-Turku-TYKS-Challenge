import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { CONFLICT, TABLE, type ImportStore } from './import-pipeline';

export function createImportStore(client: SupabaseClient<Database>): ImportStore {
  // Dataset names/columns are server-owned constants; no caller-supplied table names.
  const sb = client as SupabaseClient;
  return {
    async read(table, columns, field, values) {
      const results: Record<string, unknown>[] = [];
      for (let offset=0; offset<values.length; offset+=400) {
        await Promise.all(Array.from({length:4}, async (_,slot) => {
          const ids=values.slice(offset+slot*100,offset+(slot+1)*100);
          if (!ids.length) return;
          for (let start=0;;start+=1000) {
            const {data,error}=await sb.from(table).select(columns).in(field,ids).range(start,start+999);
            if (error) throw error;
            const rows=(data ?? []) as unknown as Record<string,unknown>[];
            results.push(...rows);
            if (rows.length<1000) break;
          }
        }));
      }
      return results;
    },
    async insert(dataset, records) {
      const {data,error}=await sb.from(TABLE[dataset]).upsert(records,{onConflict:CONFLICT[dataset],ignoreDuplicates:true}).select(CONFLICT[dataset]);
      if (error) throw error;
      return data?.length ?? 0;
    },
  };
}