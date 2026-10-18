import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/aei/i18n";
import { ResultsUnavailable } from "./ResultStatus";

afterEach(cleanup);
describe("Unavailable information recovery", () => {
  it.each(["en", "fi"])("lets users retry failed loads in %s", (lang) => {
    localStorage.setItem("aei-lang", lang);
    const retry = vi.fn();
    render(<I18nProvider><ResultsUnavailable onRetry={retry} /></I18nProvider>);
    const controls = screen.getAllByRole("button");
    const retryControl = controls.at(-1);
    if (!retryControl) throw new Error("Missing retry control");
    fireEvent.click(retryControl);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});