import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/aei/AppShell";
import { useI18n } from "@/lib/aei/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AEI — Antibiotic Efficacy Indicator" },
      { name: "description", content: "Open antimicrobial resistance dashboard: resistance rates, trends and weekly forecasts on a synthetic dataset." },
      { property: "og:title", content: "AEI — Antibiotic Efficacy Indicator" },
      { property: "og:description", content: "Resistance rates, trends and weekly forecasts on a synthetic surveillance dataset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { lang } = useI18n();
  const fi = lang === "fi";
  const features = fi
    ? [["Resistenssi", "Osuus R / (S + R) bakteereittain, antibiooteittain ja yksiköittäin."], ["Kehitys", "Vuosi- ja neljän viikon trendit samalla laskentasäännöllä."], ["Ennuste", "Seuraavan viikon arvio, joka on testattu aiempia viikkoja vasten."]]
    : [["Resistance", "R / (S + R) by bacterium, antibiotic, unit and sample type."], ["Trends", "Annual and four-week trends using one consistent rule."], ["Forecast", "Next-week estimate, checked against earlier weeks."]];
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">{fi ? "Mikrobilääkeresistenssin seuranta" : "Antimicrobial resistance surveillance"}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          {fi ? "Näe, miten antibioottien teho muuttuu." : "See how antibiotic effectiveness is changing."}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          {fi ? "Avoin kojelauta synteettiselle aineistolle. Ei kirjautumista." : "An open dashboard on a synthetic dataset. No sign-in needed."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/resistance" search={{ kind: "annual" }}>{fi ? "Avaa kojelauta" : "Open dashboard"}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/dashboard">{fi ? "Aineiston yleiskuva" : "Data overview"}</Link></Button>
        </div>
        <div className="mt-20 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {features.map(([title, text]) => (
            <div key={title} className="bg-card p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
              <p className="mt-2 text-sm">{text}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {fi ? "Ei kliiniseen käyttöön · synteettinen aineisto" : "Not for clinical use · synthetic data"}
      </footer>
    </div>
  );
}
