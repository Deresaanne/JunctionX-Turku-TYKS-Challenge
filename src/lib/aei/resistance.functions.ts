import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { DEDUP_POLICY } from './resistance';
const codes=z.array(z.string().min(1).max(150)).min(1).max(100);
const period=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('annual'),isoYear:z.number().int().min(1900).max(2200)}),
  z.object({kind:z.literal('four-week'),isoYear:z.number().int().min(1900).max(2200),isoWeek:z.number().int().min(1).max(53)}),
]);
export const getResistance = createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator(input=>z.object({period,deduplicationPolicy:z.literal(DEDUP_POLICY),antibiotics:codes,organisms:codes.optional(),wards:codes.optional(),specimens:codes.optional(),groupBy:z.array(z.enum(['organism','antibiotic','ward','specimen'])).min(2).max(4).refine(v=>v.includes('organism') && v.includes('antibiotic') && new Set(v).size===v.length,'Organism and antibiotic must remain separate dimensions').optional()}).parse(input))
  .handler(async ({data,context})=> {
    const {data:roles,error}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
    if (error || !roles?.length) throw new Error('Forbidden: data access role required');
    const {runResistance}=await import('./resistance.server');
    return runResistance(context.supabase,{
      period:data.period,deduplicationPolicy:data.deduplicationPolicy,antibiotics:data.antibiotics,
      ...(data.organisms ? {organisms:data.organisms} : {}),
      ...(data.wards ? {wards:data.wards} : {}),
      ...(data.specimens ? {specimens:data.specimens} : {}),
      ...(data.groupBy ? {groupBy:data.groupBy} : {}),
    });
  });

/** Aggregate ESBL/MRSA/VRE/CPE lab-flag counts for the dashboard. Returns
 * counts only — no isolate, patient or culture identifiers. */
export const getMarkerSummary = createServerFn({method:'POST'})
  .inputValidator(input=>z.object({period,organisms:codes.optional(),wards:codes.optional(),specimens:codes.optional()}).parse(input))
  .handler(async ({data})=> {
    // Public demo: aggregate marker counts only, read server-side.
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {loadMarkerSummary}=await import('./resistance.server');
    return loadMarkerSummary(supabaseAdmin,{
      period:data.period,
      ...(data.organisms ? {organisms:data.organisms} : {}),
      ...(data.wards ? {wards:data.wards} : {}),
      ...(data.specimens ? {specimens:data.specimens} : {}),
    });
  });
