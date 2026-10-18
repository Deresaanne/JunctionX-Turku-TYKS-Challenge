# AEI Checkpoint 6 — Dashboard
## Checkpoint 7 — Replace anomalies with weekly forecasting
- [x] Implement weekly aggregate series and time-validated regression, Holt and baseline selection, preserving existing eligibility rules.
- [x] Replace anomaly dashboard with bilingual forecast chart, counts, validation and honest unavailable states; retire active anomaly service with authenticated 410.
- [x] 178 tests passed across 13 files, build OK. Authorized EN/FI all-unit E. coli/AMP/urine forecast and ED small-sample filter verified; signed-out 401, mobile section and independent NumPy validation checked. Details and limitations: src/lib/aei/FORECASTING_VERIFICATION.md.
## Checkpoint 7 — Debug anomaly assessment
- [x] Trace the nine 2025-W52 E. coli/AMP urine groups through source records, all four windows, deduplication and safety gates; read-only SQL reproduced all counts and overlaps.
- [x] Correct cause-neutral overall and specific per-group explanations, expose aggregate patient diagnostics and assessed negatives; retain correct independence gate and all thresholds.
- [x] 168 regressions passed (12 files), build OK; authorized before/after counts and statuses exactly unchanged; all four breakdown API windows match. EN/FI expanded explanations and signed-out 401 checked. Full audit in src/lib/aei/ANOMALIES_DEBUG.md.
## Checkpoint 7 — Anomaly detection
- [x] Implement and document conservative historical comparisons using the existing engine and secure APIs.
- [x] Add bilingual dashboard review signals and insufficient-data states.
- [x] Run synthetic regression tests and authorized live integration checks; 159 tests passed across 12 files; build OK. Live E. coli/AMP 2026-W35: 16 current groups and all three historical windows exactly matched existing breakdown API counts/rates. Annual 2025 returned 23 insufficient assessments. EN/FI section, expansion and mobile fit checked; zero page errors; live signed-out 401 and invalid ward 400.
## Status usability improvement
- [x] Add plain-language bilingual statuses, explanations and status filters without changing calculations.
- [x] Verify all five cases in EN/FI using controlled browser responses, plus 23 real authorized rows; Why, Escape, filters, expansion and retry passed; no page errors.
## Trend performance
- [x] Replace bulk lookup waterfalls with RLS-scoped relational/keyset reads and distinct catalog discovery; make the unchanged role predicate statement-scoped.
- [x] Live four-year E. coli/AMP trend: 58.15 s before → 2.94 s after; complete response JSON exactly equal. Automated suite: 111 passed across 9 files; build OK.

- [x] Build resistance dashboard route with period/organism/antibiotic/ward/specimen filters, summary cards, trend chart, breakdown table and ESBL/MRSA/VRE/CPE marker panel, using the Checkpoint 5 APIs and a marker-count server function.
- [x] Run the automated test suite: 100 tests passed (6 files), build OK.
- [x] Verify live with administrator session (2026-10-17): annual 2024 E. coli/AMP 36.8% (R 996, S 1712, denom 2708) and four-week 2024-W52 39.1% (R 111, denom 284) matched the Checkpoint 4 engine; filters update results; en/fi labels render; loading and 403 error states observed.

## Known limitations
- Anomaly screening is provisional: same-patient overlap across periods, quality exclusions, incomplete history or unequal annual durations withhold inference. The live checked cohorts had no assessable groups, not evidence of stable resistance. Seasonality/case-mix adjustment and longitudinal monitoring correction are not implemented.
- New anomaly section fits 390px mobile view; pre-existing chart/table content still produces page-level horizontal overflow. Positive signals, stable negatives, empty and retry states were verified with synthetic automated tests, not live manufactured alerts. Database foundation SQL was not rerun in Checkpoint 7.
- Measured optimized four-year trend takes ~3 s; true instant loading is not guaranteed and timings depend on selected cohort and load.
- Trends request up to 5 annual / 8 four-week windows ending at the selected period; four-week start is approximated to the nearest available catalog start.
- Status retry has a retained UI regression test; full bilingual edge-case browser script is temporary, not part of the automated suite. Rollback-only foundation SQL was updated for equivalent policy formatting but not rerun this turn.
