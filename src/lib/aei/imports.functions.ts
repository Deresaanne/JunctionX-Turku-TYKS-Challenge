import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DATASET_ORDER, type Dataset } from "./validation";
import { TABLE, processCsv } from "./import-pipeline";

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return { roles: (data ?? []).map((r: { role: string }) => r.role) };
  });

export const importCsvFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    dataset: z.enum(["wards", "antibiotics", "patients", "cultures", "isolates", "susceptibility"]),
    fileName: z.string().min(1).max(255),
    text: z.string().max(25 * 1024 * 1024),
    mode: z.enum(["validate", "commit"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: permitted, error: roleError } = await context.supabase.rpc("can_import", { _user_id: context.userId });
    if (roleError || !permitted) throw new Error("Forbidden: importer or admin role required");
    const { createImportStore } = await import("./import-store.server");
    const { data: run, error: runError } = await context.supabase.from("import_runs").insert({
      dataset: data.dataset, file_name: data.fileName, started_by: context.userId,
    }).select("id").single();
    if (runError || !run) throw new Error("Could not create import report; no data was imported");
    const report = await processCsv(createImportStore(context.supabase), data.dataset, data.fileName, data.text, data.mode);
    const { error: reportError } = await context.supabase.from("import_runs").update({
      status: report.status, rows_total: report.rowsRead, rows_inserted: report.rowsImported,
      rows_duplicate: report.rowsSkipped, rows_rejected: report.rowsRejected,
      errors: report.errors, finished_at: new Date().toISOString(),
    }).eq("id", run.id).eq("started_by", context.userId);
    if (reportError) return { ...report, status: "failed" as const, errorCount: report.errorCount+1,
      errors: [...report.errors, {line:1,message:"Import report could not be saved; reported imported rows may already be stored. Retry is duplicate-safe."}] };
    return report;
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const counts: Record<string, number | null> = {};
    for (const d of DATASET_ORDER) {
      const { count } = await sb.from(TABLE[d] as keyof import("@/integrations/supabase/types").Database["public"]["Tables"]).select("*", { count: "exact", head: true });
      counts[d] = count ?? null;
    }
    const { data: runs } = await sb
      .from("import_runs")
      .select("id,dataset,file_name,status,rows_total,rows_inserted,rows_duplicate,rows_rejected,started_at,finished_at")
      .order("started_at", { ascending: false })
      .limit(20);
    return { counts, runs: runs ?? [] };
  });

/** Public demo: record counts only (no rows, no import history). */
export const getPublicOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const counts: Record<string, number | null> = {};
  for (const d of DATASET_ORDER) {
    const { count } = await supabaseAdmin.from(TABLE[d] as keyof import("@/integrations/supabase/types").Database["public"]["Tables"]).select("*", { count: "exact", head: true });
    counts[d] = count ?? null;
  }
  return { counts };
});
