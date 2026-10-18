import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/aei/AppShell";
import { getPublicOverview } from "@/lib/aei/imports.functions";
import { DATASET_ORDER } from "@/lib/aei/validation";
import { useI18n } from "@/lib/aei/i18n";

const overviewQuery = queryOptions({ queryKey: ["aei", "public-overview"], queryFn: () => getPublicOverview() });

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Data overview — AEI" },
      { name: "description", content: "Record counts in the AEI synthetic surveillance dataset." },
      { property: "og:title", content: "Data overview — AEI" },
      { property: "og:description", content: "Record counts in the AEI synthetic surveillance dataset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(overviewQuery);
  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">{t("overview")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {DATASET_ORDER.map((d) => (
          <div key={d} className="rounded-md border border-border bg-card p-4">
            <div className="font-mono text-xs uppercase text-muted-foreground">{d}</div>
            <div className="mt-1 font-mono text-2xl tabular-nums">{data.counts[d]?.toLocaleString() ?? "—"}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
