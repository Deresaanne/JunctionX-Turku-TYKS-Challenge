# Anomaly assessment audit — 2026-10-17

## Root cause and outcome
The selected cohort is Escherichia coli / AMP / urine, all wards, ISO 2025-W52. The authorized live API returned nine groups: three failed the independent-patient condition, six failed the current minimum. The counts and window construction were correct. The presentation incorrectly described every overall `insufficient-data` response as insufficient history and omitted individual assessed-negative groups.

The first patient/organism isolate is selected within each period after cohort filters, before antibiotic eligibility; selection is not reset by ward or antibiotic. S+R is eligible. Intermediate stays separate in the engine/API but is hidden in the dashboard as requested. No full challenge-specific approved replacement selection policy has been supplied; existing clinical policy is provisional.

Within-period deduplication does not remove recurrence between periods. Ordinary Fisher treats the current and pooled historical rows as independent binary observations, including independence within the pooled history. Removing or reassigning recurring patients would change the established cohort and possibly rates/thresholds. Accordingly, the existing conservative withholding solution was retained, not bypassed or replaced with an unapproved subset. All nine remain correctly unassessed; that is a data/design limitation, not a manufactured negative result.

## Exact windows
Date intervals below are inclusive; implementation uses end-exclusive comparisons.

| Window | ISO start | Included sample dates | End-exclusive |
|---|---|---|---|
| H1 | 2025-W40 | 2025-09-29–2025-10-26 | 2025-10-27 |
| H2 | 2025-W44 | 2025-10-27–2025-11-23 | 2025-11-24 |
| H3 | 2025-W48 | 2025-11-24–2025-12-21 | 2025-12-22 |
| Current | 2025-W52 | 2025-12-22–2026-01-18 | 2026-01-19 |

All four are adjacent, non-overlapping 28-day windows with identical organism/antibiotic/specimen filters and engine rules.

## Real per-period engine counts
Each cell is **R / S / eligible**. Eligible is both the selected eligible isolate count and the distinct eligible patient count in these groups. I=0 in every cell. Missing, invalid and uninterpretable counts are also 0 in all 36 group-period cells. No historical baseline or p-value is used for the withheld groups.

| Ward code | H1 | H2 | H3 | Current | Distinct recurring eligible patients | Before → after primary outcome |
|---|---|---|---|---|---|---|
| ED | 14 / 32 / 46 | 18 / 37 / 55 | 12 / 33 / 45 | 14 / 28 / 42 | 2 | Repeated-patient limitation → unchanged |
| GER | 8 / 15 / 23 | 6 / 15 / 21 | 8 / 9 / 17 | 4 / 12 / 16 | 1 | Small current sample → unchanged |
| ICU | 3 / 1 / 4 | 1 / 0 / 1 | 1 / 2 / 3 | 1 / 0 / 1 | 0 | Small current sample → unchanged |
| MED-A | 8 / 12 / 20 | 6 / 11 / 17 | 6 / 20 / 26 | 8 / 10 / 18 | 0 | Small current sample → unchanged |
| MED-B | 6 / 8 / 14 | 4 / 10 / 14 | 8 / 9 / 17 | 6 / 7 / 13 | 0 | Small current sample → unchanged |
| PHC-N | 29 / 43 / 72 | 23 / 37 / 60 | 18 / 33 / 51 | 17 / 27 / 44 | 16 | Repeated-patient limitation → unchanged |
| PHC-S | 19 / 47 / 66 | 13 / 35 / 48 | 15 / 28 / 43 | 20 / 28 / 48 | 16 | Repeated-patient limitation → unchanged |
| SURG | 1 / 2 / 3 | 1 / 1 / 2 | 1 / 1 / 2 | 1 / 1 / 2 | 0 | Small current sample → unchanged |
| URO | 11 / 27 / 38 | 6 / 17 / 23 | 6 / 11 / 17 | 10 / 16 / 26 | 1 | Small current sample → unchanged |

Overlap counts are distinct patients recurring within the same matching ward group across any of four periods, including historical-to-historical recurrence. Do not sum them as globally distinct people across wards. GER and URO also recur but fail the earlier current sample gate. All six small-current groups also have at least one historical window below 30. A primary reason is not an exhaustive list of simultaneous blockers.

### Source-to-selection audit
Cells below are **source isolates / distinct source patients / selected isolates / within-period excluded repeats**, H1→H2→H3→Current. Selected isolates equal distinct selected patients for this cohort. Selection is across wards within each period, explaining why source patients minus selected patients need not equal duplicate source patients within the ward itself.

| Ward | H1 | H2 | H3 | Current |
|---|---|---|---|---|
| ED | 48 / 48 / 46 / 2 | 55 / 55 / 55 / 0 | 46 / 46 / 45 / 1 | 44 / 43 / 42 / 2 |
| GER | 23 / 23 / 23 / 0 | 22 / 22 / 21 / 1 | 18 / 18 / 17 / 1 | 16 / 16 / 16 / 0 |
| ICU | 4 / 4 / 4 / 0 | 1 / 1 / 1 / 0 | 3 / 3 / 3 / 0 | 1 / 1 / 1 / 0 |
| MED-A | 21 / 21 / 20 / 1 | 17 / 17 / 17 / 0 | 26 / 26 / 26 / 0 | 19 / 19 / 18 / 1 |
| MED-B | 14 / 14 / 14 / 0 | 15 / 15 / 14 / 1 | 17 / 17 / 17 / 0 | 13 / 13 / 13 / 0 |
| PHC-N | 74 / 73 / 72 / 2 | 63 / 61 / 60 / 3 | 53 / 51 / 51 / 2 | 45 / 45 / 44 / 1 |
| PHC-S | 67 / 66 / 66 / 1 | 50 / 49 / 48 / 2 | 48 / 44 / 43 / 5 | 49 / 48 / 48 / 1 |
| SURG | 3 / 3 / 3 / 0 | 2 / 2 / 2 / 0 | 2 / 2 / 2 / 0 | 2 / 2 / 2 / 0 |
| URO | 39 / 39 / 38 / 1 | 24 / 23 / 23 / 1 | 17 / 17 / 17 / 0 | 26 / 26 / 26 / 0 |

## Statistical contract
Null: current resistance probability equals historical probability (one-sided null includes no increase). Alternative: higher current probability. One-sided Fisher upper tail compares [current R,S] to pooled [sum historical R,sum historical S]. All four matching complete equal-duration windows must independently have ≥30 eligible S/R, no missing/invalid/uninterpretable data, and no recurring eligible patients within the table. Positive change plus Holm-adjusted p≤0.05 yields a review signal. Holm covers assessable groups in a single request, not repeated monitoring or different selections. Decreases are displayed descriptively for assessed negatives, not detected by this upper-tail test. Patient uniqueness does not establish seasonality/case-mix exchangeability; clinical policy remains provisional.

## Changes
- `anomalies.ts`: aggregate selected/eligible patient counts per window and distinct cross-period overlap totals, including when an earlier sample gate fails. Existing counts, gates, test and correction unchanged.
- `AnomalySection.tsx`, `i18n.tsx`: cause-neutral overall message, visible reason totals, specific explanations with actual minimum/counts, per-window details, and assessed-negative list; Intermediate remains hidden. Existing loading/error/retry states retained.
- `anomalies.test.ts`, `anomalies-api.test.ts`, `AnomalySection.test.tsx`: independent patients, historical recurrence, I-only recurrence, first-isolate-before-eligibility, exact W52 windows, sample-gate precedence, API overlap and bilingual explanations.
- `ANOMALIES.md`, `AGENTS.md`, `roadmap.md`: method, diagnostics and implementation rules documented.

## Executed verification
- `bunx vitest run`: **168 passed across 12 files**. Expected generic log messages arose in deliberate error-path tests; no failing tests.
- Preview build log: **build OK** after changes.
- Authorized live before/after JSON equality after removing only the three new diagnostic fields: exact equality. Zero tested, nine withheld, no baseline/p-values before and after.
- Independent read-only database aggregation reproduced all 36 source/selected R/S/I/eligible counts and recurring patient totals.
- All four windows fetched separately through the existing breakdown API: R/S/I/eligible/rate/repeat counts exactly matched anomaly responses for every group.
- Real English/Finnish dashboard, visible primary blockers and expanded counts checked; no false overall historical-data headline; Intermediate absent. Live signed-out anomaly call returned 401; no-role 403 and role access passed automated tests.
- Genuine positive and stable independent comparisons are synthetic tests, not real alerts manufactured from this cohort. No imported records or roles changed. Foundation rollback SQL not rerun; nothing published.