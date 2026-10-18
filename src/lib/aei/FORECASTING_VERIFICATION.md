# Forecasting replacement — executed verification

## Implemented

- Replaced the anomaly query/panel in the resistance dashboard with `ForecastSection`: latest complete observed week, next-week estimate, percentage-point change, history and dashed forecast point, three-model comparison, validation error, weekly counts and bilingual warnings.
- Weekly adapter delegates to the same resistance selection/eligibility implementation, with seven-day periods only. Four-week/annual callers are unchanged.
- Pure forecasting module compares regression and training-tuned Holt with last-value baseline using expanding-window time-based validation; baseline wins ties.
- Shared authenticated API adds `/api/public/aei/forecast`. The old anomaly endpoint authenticates then returns 410. Live anomaly inference and UI have been removed; historical pure tests/audit documents remain unused by the dashboard/API.
- Source rows, schema, roles, completed reporting/import features and marker calculations were not modified.

## Executed automated checks

`bunx vitest run`: **178 tests passed, 13 files**, 2026-10-17 17:40 UTC. Includes 20 forecasting tests, 13 forecast API tests, 4 bilingual forecast presentation/state tests, all remaining existing regression tests. An early presentation test failed because two model-summary elements matched its selector; the test was corrected to allow those legitimate matches, then the complete suite passed. Latest preview build: OK.

Coverage: regression/Holt/baseline calculations; held-out folds using earlier weeks only; clipping and ties; true seven-day boundaries and ISO year changes; missing date gaps; incomplete source coverage; 29/30 threshold; I-before-S repeated selection; missing/invalid exclusions; cohort filters; aggregate privacy; viewer/importer/admin authorization; signed-out/no-role rejection; malformed filters; service failure sanitization; English/Finnish forecast, small-sample, loading, empty, selection and retry states. UI unit tests stub chart rendering; real chart verified in browser.

## Actual authorized data

Selection: E. coli / AMP / urine, all healthcare units; four-week as-of 2025-W52. The selected four-week window ends 2026-01-19 exclusive, so the last observed full week is **2026-W3, 2026-01-12–2026-01-18**, and forecast is **2026-W4, starting 2026-01-19**. This is a historical forecast, not a claim to predict the week after today.

- 52 usable consecutive weeks.
- Latest R=13, S=35, S+R=48; observed rate 27.083333333333332%.
- Selected regression forecast 35.820050746858634%; change +8.736717413525302 percentage points.
- Held-out four-week MAE: regression **8.149098276071083 pp**, Holt **10.213980531244427 pp**, baseline **12.189581021087683 pp**.
- An actual authorized endpoint request returned HTTP 200 in **0.65 seconds** in one measured run. This is not a loading-time guarantee.
- Independent NumPy ordinary-least-squares fit and all four validation predictions reproduced API regression MAE/forecast within 1e-10.

Browser: same actual counts, percentage, forecast and MAE read back in English and Finnish. No page errors. Forecast graph displayed observed history and forecast point. Signed-out HTTP request returned **401**. Changing healthcare-unit filter to ED updated URL/results: latest S+R=9, observed rate and forecast correctly withheld, explicit need for at least 30; all 52 weeks marked small-sample. Section screenshots inspected at desktop and 390px width; the forecast section itself fits mobile (pre-existing unrelated page overflow was not redesigned).

## Limitations

- Only four held-out weeks compare models: winning score can be optimistic and is not an independent final test. No claim of clinical accuracy.
- No validated prediction intervals; seasonality, case mix, reporting delays and recurring-patient temporal dependence are not adjusted.
- Global date range is coverage, not proof all labs have finished reporting.
- Require one bacterium/antibiotic, >=12 consecutive reportable clean weeks, >=30 eligible results per week. Many narrow healthcare-unit cohorts legitimately cannot forecast.
- Forecast is next week after the selected as-of period's latest fully covered week; historical selections stay historical. Weekly dedup scope remains provisional.
- Database foundation SQL was not rerun; no database changes were made.

## Files

Added `forecast.ts`, `forecast.test.ts`, `forecast-api.test.ts`, `ForecastSection.tsx`, `ForecastSection.test.tsx`, `routes/api/public/aei/forecast.ts`, `FORECASTING.md`, this verification report. Updated `resistance.ts`, `api.ts`, `api.server.ts`, resistance dashboard, `i18n.tsx`, dependency manifest/lock, `AGENTS.md`, `roadmap.md`. Removed obsolete `AnomalySection.tsx`, its UI test and active anomaly API test; endpoint retirement has a replacement regression test.