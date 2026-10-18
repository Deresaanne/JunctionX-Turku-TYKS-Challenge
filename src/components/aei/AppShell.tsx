import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LangToggle, useI18n } from "@/lib/aei/i18n";

export function SiteHeader() {
  const { t } = useI18n();
  const item = "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold tracking-widest text-primary">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />AEI
        </Link>
        <nav className="order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1" aria-label="Main">
          <Link to="/dashboard" className={item} activeProps={{ className: "bg-muted text-foreground" }}>{t("overview")}</Link>
          <Link to="/resistance" search={{ kind: "annual" }} className={item} activeProps={{ className: "bg-muted text-foreground" }}>{t("resistance")}</Link>
          <Link to="/about" className={item} activeProps={{ className: "bg-muted text-foreground" }}>{t("about")}</Link>
        </nav>
        <div className="ml-auto shrink-0"><LangToggle /></div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
