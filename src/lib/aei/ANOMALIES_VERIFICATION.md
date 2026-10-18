# Checkpoint 7 executed verification — 2026-10-17

- Full `bunx vitest run`: **159 tests passed, 12 files**. New tests: 24 statistical/engine checks, 18 API checks, 6 bilingual presentation/state checks. Existing import, validation, resistance, reader, API/auth, result-status and routing tests passed.
- Latest preview compilation: build OK. Fixed a development-runtime CommonJS import mismatch before live verification; final live page had zero page errors.
- Independent SciPy Fisher reference for `[[6,4],[3,27]]`, greater alternative: 0.003313939846447586; implementation matched to 12 decimal places.
- Authorized live E. coli/AMP, four-week 2026-W35 (2026-08-24–2026-09-20): HTTP 200; 16 assessments, zero tested, zero anomalies. Reasons: small-current-sample, insufficient-history, overlapping-patients. Every current R/S/I/eligible/rate field exactly equaled the existing breakdown endpoint. All three preceding historical windows were independently fetched from that endpoint and matched each available group's R/S/I/eligible/rate fields, including missing groups.
- Authorized live annual ISO 2025 E. coli/AMP: HTTP 200; 23 assessments, insufficient-data.
- Live invalid ward: 400. Live missing bearer: 401. No-role 403 and viewer/importer/admin acceptance executed in automated API tests (no role changes made).
- English/Finnish dashboard region and expanded insufficient-data explanations observed in browser. At 390×844, the anomaly region fit without its own overflow. Existing chart/table content still caused page-level horizontal overflow; no redesign was attempted.
- Positive signal, stable negative, small sample, missing/invalid data, missing history, zero observations, repetitions, group filters, intervals, correction, EN/FI loading/empty/error/retry states were synthetic automated tests. No real alerts were manufactured, and no imported records or access controls were changed.

## Scope of claims
This verifies implementation and the stated live integration cases, not clinical validity. No live assessable positive signal was observed; real checked cohorts were explicitly insufficient. Underlying clinical rules, baseline exchangeability, complete source coverage, seasonality and continual/repeated monitoring error control remain provisional. Foundation rollback SQL was not rerun; publication was not requested or performed.