import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/aei/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getMyRoles, getOverview, importCsvFile } from "@/lib/aei/imports.functions";
import type { ImportSummary } from "@/lib/aei/import-pipeline";
import { DATASET_ORDER, type Dataset } from "@/lib/aei/validation";
import { useI18n } from "@/lib/aei/i18n";
const overviewQuery = queryOptions({ queryKey: ["aei", "overview"], queryFn: () => getOverview() });
const rolesQuery = queryOptions({ queryKey: ["aei", "roles"], queryFn: () => getMyRoles() });

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({
    meta: [
      { title: "Imports — AEI" },
      { name: "description", content: "Validated CSV import of surveillance data with import reports." },
      { property: "og:title", content: "Imports — AEI" },
      { property: "og:description", content: "Validated CSV import of surveillance data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(overviewQuery), context.queryClient.ensureQueryData(rolesQuery)]),
  component: ImportsPage,
});



function ImportsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(overviewQuery);
  const { data: roles } = useSuspenseQuery(rolesQuery);
  const canImport = roles.roles.includes("admin") || roles.roles.includes("importer");
  const [dataset, setDataset] = useState<Dataset>("wards");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<ImportSummary[]>([]);
  const importFile = useServerFn(importCsvFile);

  async function run(mode: "validate" | "commit") {
    if (!files.length) return;
    setBusy(true); setReports([]); setProgress(0);
    try {
      const detected = files.map(file => ({ file, dataset: files.length === 1 ? dataset : DATASET_ORDER.find(d => file.name === `${d}.csv`) }));
      if (detected.some(f => !f.dataset)) throw new Error("Use the six original CSV filenames when selecting multiple files.");
      detected.sort((a,b) => DATASET_ORDER.indexOf(a.dataset ?? dataset)-DATASET_ORDER.indexOf(b.dataset ?? dataset));
      for (let i=0;i<detected.length;i++) {
        const current=detected[i];
        if (!current?.dataset) continue;
        const result=await importFile({ data: { dataset: current.dataset, fileName: current.file.name, text: await current.file.text(), mode } });
        setReports(previous => [...previous,result]);
        setProgress((i+1)/detected.length*100);
        if (result.status === "failed" || result.status === "rejected") break;
      }
      qc.invalidateQueries({queryKey:["aei"]});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed; completion was not confirmed.");
    } finally { setBusy(false); }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">{t("imports")}</h1>
      {!canImport ? (
        <p className="rounded-md border border-border bg-muted p-4 text-sm">{t("importerOnly")}</p>
      ) : (
        <section className="space-y-4 rounded-md border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {files.map(f => f.name).join(" · ")}
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-sm">
              <div>{t("dataset")}</div>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={dataset}
                onChange={(e) => setDataset(e.target.value as Dataset)}
              >
                {DATASET_ORDER.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <div>{t("chooseFile")}</div>
              <input aria-label="CSV files" type="file" multiple accept=".csv,text/csv" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-sm" />
            </label>
            <Button variant="outline" disabled={!files.length || busy} onClick={() => run("validate")}>{t("validate")}</Button>
            <Button disabled={!files.length || busy} onClick={() => run("commit")}>{t("importNow")}</Button>
          </div>
          {(busy || progress > 0) && <Progress value={Math.min(progress, 100)} />}
          {reports.map((report,i) => (
            <div key={i} className="space-y-2 border-t border-border pt-4 font-mono text-sm" data-testid="import-report">
              <div className="break-words">{report.fileName}: <span className={report.status === "failed" || report.status === "rejected" ? "text-destructive" : "text-primary"}>{report.status}</span></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Read: {report.rowsRead}</span><span>Imported: {report.rowsImported}</span><span>Updated: {report.rowsUpdated}</span>
                <span>Skipped: {report.rowsSkipped}</span><span>Rejected: {report.rowsRejected}</span>
              </div>
              {report.errorCount > 0 && <>
                <div>Errors: {report.errorCount}</div>
                <ul className="max-h-64 overflow-auto text-xs">
                  {report.errors.map((e,j) => <li key={j}>Record {e.line}{e.field ? ` [${e.field}]` : ""}: {e.message}</li>)}
                </ul>
              </>}
            </div>
          ))}
        </section>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">{t("recentRuns")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2">{t("dataset")}</th><th>file</th><th>{t("status")}</th><th>{t("rows")}</th><th>{t("inserted")}</th><th>dup</th><th>{t("rejected")}</th><th>started</th></tr>
          </thead>
          <tbody>
            {data.runs.map((r: { id: string; dataset: string; file_name: string; status: string; rows_total: number; rows_inserted: number; rows_duplicate: number; rows_rejected: number; started_at: string }) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2">{r.dataset}</td><td>{r.file_name}</td><td>{r.status}</td><td>{r.rows_total}</td>
                <td>{r.rows_inserted}</td><td>{r.rows_duplicate}</td><td>{r.rows_rejected}</td>
                <td>{new Date(r.started_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
