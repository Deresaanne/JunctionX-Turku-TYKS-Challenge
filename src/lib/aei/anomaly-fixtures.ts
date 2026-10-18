import { anomalyPeriods, assessAnomalies } from './anomalies';
import { DEDUP_POLICY, resolvePeriod, type Observation, type CalculationRequest } from './resistance';
export const periods = anomalyPeriods({kind:'four-week',isoYear:2025,isoWeek:13});
export const requests: CalculationRequest[] = periods.map(period=>({period,deduplicationPolicy:DEDUP_POLICY,antibiotics:['AMP'],groupBy:['organism','antibiotic','ward','specimen']}));
export function fixture(rates=[10,10,10,60], n=100, ward='ICU'): Observation[] {
  return rates.flatMap((r,p)=>Array.from({length:n},(_,i)=>({isolateId:`${ward}-${p}-${i}`,patientId:`${ward}-p${p}-${i}`,cultureId:`c${p}-${i}`,isolateNo:1,organism:'E. coli',sampleDate:resolvePeriod(periods[p] ?? periods[0] ?? {kind:'annual',isoYear:2025}).start,ward,specimen:'blood',cultureResult:'positive',results:[{antibiotic:'AMP',result:i<r?'R':'S'}]})));
}
export const assess = (rows=fixture(), req=requests) => assessAnomalies(rows,req,{start:'2020-01-01',end:'2026-12-31'},'2027-01-01');
