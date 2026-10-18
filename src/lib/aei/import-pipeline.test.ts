import { describe, expect, it } from 'vitest';
import { processCsv, TABLE, CONFLICT, type ImportStore } from './import-pipeline';
import { EXPECTED_HEADERS, type Dataset } from './validation';

const csv = (dataset: Dataset, records: Record<string,string>[]) => [EXPECTED_HEADERS[dataset].join(','), ...records.map(r => EXPECTED_HEADERS[dataset].map(h => r[h] ?? '').join(','))].join('\r\n');
class MemoryStore implements ImportStore {
  rows: Record<string,Record<string,unknown>[]> = {
    patients: [{patient_id:'P1',sex:null,birth_year:null,home_area:null}],
    wards: [{ward_code:'W1',label_fi:'Osasto',label_en:'Ward',ward_type:'in',institution:'hospital'}],
    specimen_types: [{specimen_code:'blood',label_fi:'veri'}],
    antibiotics: [{antibiotic_code:'AMP',label_en:'Ampicillin',label_fi:'Ampisilliini',drug_class:'test',reported_for:'test'}],
    cultures: [{culture_id:'C1'}], isolates: [{isolate_id:'X1',culture_id:'C1',organism:'E. coli',isolate_no:1}],
  };
  writes=0;
  async read(table:string,_columns:string,field:string,values:string[]) { return (this.rows[table] ?? []).filter(r => values.includes(String(r[field]))); }
  async insert(dataset:Dataset,records:Record<string,unknown>[]) {
    this.writes++;
    const rows=this.rows[TABLE[dataset]] ??= [];
    const fields=CONFLICT[dataset].split(',');
    let inserted=0;
    for(const record of records) if (!rows.some(r => fields.every(f=>r[f]===record[f]))) {rows.push(record);inserted++;}
    return inserted;
  }
}
const culture={culture_id:'C2',patient_id:'P1',sample_date:'2026-10-17',iso_year:'2026',iso_week:'42',ward_code:'W1',ward_fi:'Osasto',ward_en:'Ward',ward_type:'in',institution:'hospital',admission_date:'',specimen:'blood',specimen_fi:'veri',result:'positive',n_isolates:'1'};
const testResult={isolate_id:'X1',culture_id:'C1',organism:'E. coli',antibiotic:'Ampicillin',antibiotic_code:'AMP',antibiotic_fi:'Ampisilliini',result:'I',guideline:'EUCAST 2026'};
describe('server-owned CSV imports',()=>{
  it('rejects invalid headers before writing',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'patients','patients.csv','id,sex\nP2,F','commit');
    expect(r.status).toBe('rejected');expect(r.rowsRejected).toBe(1);expect(store.writes).toBe(0);
  });
  it('rejects duplicate headers',async()=>{
    const r=await processCsv(new MemoryStore(),'patients','patients.csv','patient_id,patient_id,sex,birth_year,home_area\nP2,P2,F,2000,area','commit');
    expect(r.errors.some(e=>e.message==='Duplicate column names')).toBe(true);
  });
  it('rejects malformed CSV and mismatched field counts',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'patients','patients.csv','patient_id,sex,birth_year,home_area\nP2,"unterminated','commit');
    expect(r.status).toBe('rejected');expect(store.writes).toBe(0);expect(r.errorCount).toBeGreaterThan(0);
  });
  it('rejects malformed dates and the entire file',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'cultures','cultures.csv',csv('cultures',[culture,{...culture,culture_id:'C3',sample_date:'2026-02-30'}]),'commit');
    expect(r.rowsImported).toBe(0);expect(r.rowsRejected).toBe(2);expect(r.errors.some(e=>e.field==='sample_date'&&e.line===3)).toBe(true);
  });
  it('reports missing IDs',async()=>{
    const r=await processCsv(new MemoryStore(),'patients','patients.csv',csv('patients',[{patient_id:''}]),'commit');
    expect(r.status).toBe('rejected');expect(r.errors.some(e=>e.field==='patient_id')).toBe(true);
  });
  it('preserves optional empty admission dates',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'cultures','cultures.csv',csv('cultures',[culture]),'commit');
    expect(r.rowsImported).toBe(1);expect(store.rows["cultures"]?.find(c=>c["culture_id"]==='C2')?.["admission_date"]).toBeNull();
  });
  it('reports invalid foreign keys before writing',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'cultures','cultures.csv',csv('cultures',[{...culture,patient_id:'MISSING'}]),'commit');
    expect(r.status).toBe('rejected');expect(store.writes).toBe(0);expect(r.errors.some(e=>e.field==='patient_id')).toBe(true);
  });
  it('preserves I and skips an unchanged repeated import',async()=>{
    const store=new MemoryStore();const text=csv('susceptibility',[testResult]);
    const first=await processCsv(store,'susceptibility','susceptibility.csv',text,'commit');
    const repeat=await processCsv(store,'susceptibility','susceptibility.csv',text,'commit');
    expect(first.rowsImported).toBe(1);expect(repeat.status).toBe('completed');expect(repeat.rowsImported).toBe(0);expect(repeat.rowsUpdated).toBe(0);expect(repeat.rowsSkipped).toBe(1);
    expect(store.rows["susceptibility_results"]?.[0]?.["result"]).toBe('I');expect(store.rows["susceptibility_results"]).toHaveLength(1);
  });
  it.each(['','SDD','unknown','s'])('rejects unexpected susceptibility %s without conversion',async(result)=>{
    const store=new MemoryStore();const r=await processCsv(store,'susceptibility','susceptibility.csv',csv('susceptibility',[{...testResult,result}]),'commit');
    expect(r.status).toBe('rejected');expect(r.rowsImported).toBe(0);expect(store.writes).toBe(0);
  });
  it('rejects changed existing IDs rather than overwriting or silently skipping',async()=>{
    const store=new MemoryStore();await processCsv(store,'susceptibility','susceptibility.csv',csv('susceptibility',[testResult]),'commit');
    const r=await processCsv(store,'susceptibility','susceptibility.csv',csv('susceptibility',[{...testResult,result:'R'}]),'commit');
    expect(r.status).toBe('rejected');expect(r.rowsUpdated).toBe(0);expect(store.rows["susceptibility_results"]?.[0]?.["result"]).toBe('I');
  });
  it('rejects duplicates within one file',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'patients','patients.csv',csv('patients',[{patient_id:'P2'},{patient_id:'P2'}]),'commit');
    expect(r.status).toBe('rejected');expect(store.writes).toBe(0);
  });
  it('preserves text quantities and unknown laboratory flags',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'isolates','isolates.csv',csv('isolates',[{isolate_id:'X2',culture_id:'C1',isolate_no:'2',organism:'E. coli',quantity:'>=10^5',esbl:'',mrsa:'0',vre:'unknown',cpe:'1'}]),'commit');
    expect(r.rowsImported).toBe(1);expect(store.rows["isolates"]?.find(i=>i["isolate_id"]==='X2')).toMatchObject({quantity:'>=10^5',esbl:null,mrsa:false,vre:null,cpe:true});
  });
  it('rejects text in integer fields instead of coercing to zero',async()=>{
    const r=await processCsv(new MemoryStore(),'patients','patients.csv',csv('patients',[{patient_id:'P2',birth_year:'unknown'}]),'commit');
    expect(r.status).toBe('rejected');expect(r.errors.some(e=>e.field==='birth_year')).toBe(true);
  });
  it('checks denormalized susceptibility relationships',async()=>{
    const r=await processCsv(new MemoryStore(),'susceptibility','susceptibility.csv',csv('susceptibility',[{...testResult,culture_id:'WRONG'}]),'commit');
    expect(r.status).toBe('rejected');expect(r.errors.some(e=>e.field==='culture_id')).toBe(true);
  });
  it('checks alternate isolate uniqueness',async()=>{
    const r=await processCsv(new MemoryStore(),'isolates','isolates.csv',csv('isolates',[{isolate_id:'X2',culture_id:'C1',isolate_no:'1',organism:'test'}]),'commit');
    expect(r.status).toBe('rejected');expect(r.errors.some(e=>e.field==='isolate_no')).toBe(true);
  });
  it('reports partial database failure honestly and remains retry-safe',async()=>{
    const store=new MemoryStore();const original=store.insert.bind(store);
    store.insert=async(d,r)=>{if(store.writes===1)throw new Error('outage');return original(d,r);};
    const text=csv('patients',Array.from({length:501},(_,i)=>({patient_id:`new-${i}`})));
    const r=await processCsv(store,'patients','patients.csv',text,'commit');
    expect(r.status).toBe('failed');expect(r.rowsImported).toBe(500);expect(r.rowsRejected).toBe(1);
    store.insert=original;const retry=await processCsv(store,'patients','patients.csv',text,'commit');
    expect(retry.rowsImported).toBe(1);expect(retry.rowsSkipped).toBe(500);
  });
  it('validation-only does not insert',async()=>{
    const store=new MemoryStore();const r=await processCsv(store,'patients','patients.csv',csv('patients',[{patient_id:'P2'}]),'validate');
    expect(r.status).toBe('validated');expect(store.writes).toBe(0);
  });
});