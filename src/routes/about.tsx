import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/aei/AppShell";
import { useI18n, type Key } from "@/lib/aei/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — AEI — Antibiotic Efficacy Indicator" },
      {
        name: "description",
        content:
          "AEI is a data-driven platform for antimicrobial resistance surveillance: resistance trends, historical data and weekly forecasting. Built by researchers at Tampere University and the University of Helsinki.",
      },
      { property: "og:title", content: "About AEI — Antibiotic Efficacy Indicator" },
      {
        property: "og:description",
        content: "How the AEI surveillance platform works, who builds it, and why resistance monitoring matters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const TEAM: { name: string; initials: string; role: Key; affiliation: Key }[] = [
  { name: "Rajarshi Ray", initials: "RR", role: "roleResearcher", affiliation: "affTampere" },
  { name: "Yunseon Lee", initials: "YL", role: "roleDoctoral", affiliation: "affHelsinki" },
];

function About() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">{t("aboutEyebrow")}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {t("aboutHeading")}
          <span className="mt-3 block text-xl font-medium tracking-normal text-muted-foreground md:text-2xl">
            {t("appName")}
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t("aboutIntro")}</p>

        <section className="mt-16 grid gap-8 border-t border-border pt-10 md:grid-cols-3" aria-labelledby="mission">
          <h2 id="mission" className="text-xl font-semibold tracking-tight md:sticky md:top-24 md:self-start">
            {t("missionTitle")}
          </h2>
          <div className="space-y-4 text-muted-foreground md:col-span-2">
            <p className="leading-relaxed">{t("missionBody")}</p>
            <p className="leading-relaxed">{t("missionSecond")}</p>
          </div>
        </section>

        <section className="mt-16 border-t border-border pt-10" aria-labelledby="team">
          <h2 id="team" className="text-xl font-semibold tracking-tight">
            {t("teamTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("teamIntro")}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {TEAM.map((m) => (
              <li key={m.name} className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-sm font-semibold text-primary"
                  >
                    {m.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-tight text-foreground">{m.name}</p>
                    <p className="mt-0.5 text-sm text-primary">{t(m.role)}</p>
                  </div>
                </div>
                <p className="mt-4 border-t border-border pt-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {t(m.affiliation)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-border pt-10">
          <Button asChild size="lg">
            <Link to="/resistance" search={{ kind: "annual" }}>
              {t("aboutDashboard")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard">{t("overview")}</Link>
          </Button>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {t("provisional")}
      </footer>
    </div>
  );
}
