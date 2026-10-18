import { checkHeaders, findInFileDuplicates, parseCsv, validateRow, type Dataset, type RawRow, type RowError, type ValidatedRow } from './validation';

export const TABLE: Record<Dataset, string> = { wards: 'wards', antibiotics: 'antibiotics', patients: 'patients', cultures: 'cultures', isolates: 'isolates', susceptibility: 'susceptibility_results' };
export const CONFLICT: Record<Dataset, string> = { wards: 'ward_code', antibiotics: 'antibiotic_code', patients: 'patient_id', cultures: 'culture_id', isolates: 'isolate_id', susceptibility: 'isolate_id,antibiotic_code' };
type RecordData = Record<string, unknown>;
export interface ImportStore {
  read(table: string, columns: string, field: string, values: string[]): Promise<RecordData[]>;
  insert(dataset: Dataset, records: RecordData[]): Promise<number>;
}
export type ImportSummary = { fileName: string; dataset: Dataset; status: 'validated' | 'completed' | 'rejected' | 'failed'; rowsRead: number; rowsImported: number; rowsUpdated: number; rowsSkipped: number; rowsRejected: number; errors: RowError[]; errorCount: number };
const targets: Record<string, [string, string, string]> = {
  patient_id: ['patients', 'patient_id', 'patient_id'],
  ward_code: ['wards', 'ward_code', 'ward_code,label_fi,label_en,ward_type,institution'],
  specimen_code: ['specimen_types', 'specimen_code', 'specimen_code,label_fi'],
  culture_id: ['cultures', 'culture_id', 'culture_id'],
  isolate_id: ['isolates', 'isolate_id', 'isolate_id,culture_id,organism'],
  antibiotic_code: ['antibiotics', 'antibiotic_code', 'antibiotic_code,label_en,label_fi'],
};
const naturalKey = (dataset: Dataset, row: RecordData) => JSON.stringify(CONFLICT[dataset].split(',').map(f => row[f]));
const sameRecord = (record: RecordData, existing: RecordData) => Object.keys(record).every(f => record[f] === existing[f]);

/** All source and relational validation finishes before any inserts start. */
export async function processCsv(store: ImportStore, dataset: Dataset, fileName: string, text: string, mode: 'validate' | 'commit'): Promise<ImportSummary> {
  const summary: ImportSummary = { fileName, dataset, status: 'validated', rowsRead: 0, rowsImported: 0, rowsUpdated: 0, rowsSkipped: 0, rowsRejected: 0, errors: [], errorCount: 0 };
  const addError = (error: RowError) => { summary.errorCount++; if (summary.errors.length < 500) summary.errors.push(error); };
  try {
    const parsed = parseCsv(text);
    summary.rowsRead = parsed.rows.length;
    parsed.errors.forEach(addError);
    checkHeaders(dataset, parsed.headers).forEach(message => addError({ line: 1, message }));
    if (!parsed.rows.length) addError({ line: 1, message: 'File contains no data records' });
    if (summary.errorCount) { summary.status = 'rejected'; summary.rowsRejected = summary.rowsRead; return summary; }
    findInFileDuplicates(dataset, parsed.rows).forEach(addError);
    const valid: { line: number; value: ValidatedRow; raw: RawRow }[] = [];
    parsed.rows.forEach((raw, i) => {
      const result = validateRow(dataset, raw, i + 2);
      if (result.ok) valid.push({ line: i + 2, value: result.value, raw });
      else result.errors.forEach(addError);
    });
    const refs = new Map<string, Map<unknown, RecordData>>();
    for (const field of new Set(valid.flatMap(v => Object.keys(v.value.refs)))) {
      const target = targets[field];
      if (!target) throw new Error('Unsupported reference field');
      const [table, column, columns] = target;
      const ids = [...new Set(valid.map(v => v.value.refs[field]).filter((id): id is string => typeof id === "string" && id.length > 0))];
      const rows = await store.read(table, columns, column, ids);
      refs.set(field, new Map(rows.map(r => [r[column], r])));
    }
    const checkLabel = (line: number, raw: RawRow, target: RecordData | undefined, pairs: [string,string][]) => {
      if (!target) return;
      for (const [source, dest] of pairs) {
        if (!raw[source]) addError({ line, field: source, message: 'required' });
        else if (raw[source] !== target[dest]) addError({ line, field: source, message: 'Source value differs from referenced record; review required' });
      }
    };
    for (const { line, value, raw } of valid) {
      for (const [field, id] of Object.entries(value.refs)) {
        if (!refs.get(field)?.has(id)) addError({ line, field, message: 'Referenced ID does not exist (or is not accessible)' });
      }
      if (dataset === 'cultures') {
        checkLabel(line, raw, refs.get('ward_code')?.get(raw["ward_code"]), [['ward_fi','label_fi'],['ward_en','label_en'],['ward_type','ward_type'],['institution','institution']]);
        checkLabel(line, raw, refs.get('specimen_code')?.get(raw["specimen"]), [['specimen_fi','label_fi']]);
      }
      if (dataset === 'susceptibility') {
        checkLabel(line, raw, refs.get('isolate_id')?.get(raw["isolate_id"]), [['culture_id','culture_id'],['organism','organism']]);
        checkLabel(line, raw, refs.get('antibiotic_code')?.get(raw["antibiotic_code"]), [['antibiotic','label_en'],['antibiotic_fi','label_fi']]);
      }
    }
    const keyField = CONFLICT[dataset].split(',')[0] ?? '';
    const existing = await store.read(TABLE[dataset], '*', keyField, [...new Set(valid.map(v => String(v.value.record[keyField])))]);
    const byKey = new Map(existing.map(r => [naturalKey(dataset, r), r]));
    if (dataset === 'isolates') {
      const siblings = await store.read('isolates', 'isolate_id,culture_id,isolate_no', 'culture_id', [...new Set(valid.map(v => String(v.value.record["culture_id"])))]);
      const positions = new Map(siblings.map(r => [JSON.stringify([r["culture_id"],r["isolate_no"]]),r["isolate_id"]]));
      for (const {line,value} of valid) {
        const position = JSON.stringify([value.record["culture_id"],value.record["isolate_no"]]);
        const occupying = positions.get(position);
        if (occupying && occupying !== value.record["isolate_id"]) addError({line, field:'isolate_no', message:'Culture/isolate number already belongs to another isolate ID'});
        positions.set(position,value.record["isolate_id"]);
      }
    }
    const pending: RecordData[] = [];
    for (const {line,value} of valid) {
      const prior = byKey.get(naturalKey(dataset,value.record));
      if (prior && !sameRecord(value.record,prior)) addError({line, message:'Existing ID has different values; no overwrite performed. Review required'});
      else if (prior) summary.rowsSkipped++;
      else pending.push(value.record);
    }
    if (summary.errorCount) { summary.status='rejected'; summary.rowsSkipped=0; summary.rowsRejected=summary.rowsRead; return summary; }
    if (mode === 'validate') return summary;
    for (let i=0; i<pending.length; i+=500) {
      const batch=pending.slice(i,i+500);
      const inserted=await store.insert(dataset,batch);
      summary.rowsImported+=inserted;
      summary.rowsSkipped+=batch.length-inserted;
    }
    summary.status='completed';
  } catch {
    summary.status='failed';
    summary.rowsRejected=summary.rowsRead-summary.rowsImported-summary.rowsSkipped;
    addError({line:1,message:'Database operation failed. Any reported imported rows remain stored; retry is duplicate-safe. No success claimed.'});
  }
  return summary;
}