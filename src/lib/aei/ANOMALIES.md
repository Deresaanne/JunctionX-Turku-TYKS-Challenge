# Checkpoint 7 — provisional anomaly review signals

## Method and criteria
**Null hypothesis:** the current and pooled historical observations have the same probability of resistance (the one-sided null includes no increase). The alternative is a higher current probability. Decreases are descriptive negative changes only; this prespecified upper-tail test does not detect decreases. “No unusual increase detected” is not evidence of stability or absence of a decrease.

The prespecified direction is an **increase**, not all changes or a high absolute rate. A one-sided Fisher exact upper-tail test compares current R/S counts against the pooled R/S counts of the three immediately preceding periods. Fixed-margin hypergeometric probabilities are evaluated with jStat log-gamma and log-sum-exp; zero cells are allowed. Wilson 95% marginal intervals are returned for descriptive uncertainty (not a simultaneous confidence guarantee).

Each period uses the unmodified Checkpoint 4 engine, with the same selected cohort filters, first patient/organism isolate per period, deterministic ties, and grouping by organism × antibiotic × ward × specimen. S+R is the denominator; I is separate, and missing/invalid/uninterpretable observations are never S. Every one of the four periods must independently reach the existing minimum of 30 S/R observations. Pooling cannot mask a small historical sample.

The baseline is count-weighted: sum(history R) / sum(history S+R), not the average of percentages. Four-week windows are exactly 28 days, immediately before the selected current ISO Monday. Annual windows are the three preceding ISO years; all four must have identical duration (52/53-week mismatches are withheld). There are no gaps, overlaps, or substitution of distant periods. The user-selected period is assessed, never silently replaced with a different eligible period; the dashboard defaults to its existing latest available selection. An unfinished period is withheld.

A review signal requires positive percentage-point change and **Holm-adjusted p ≤ 0.05**. The conventional 5% family-wise error level is a provisional screening policy, not an approved clinical threshold. Holm is applied to every assessable group in the complete filtered request (including stable groups), and is valid under dependence between tests. No effect-size or clinical-risk cutoff is invented.

## Conservative safety gates
- All four windows must fit within observed dataset date bounds and have ended by the server UTC date. Date bounds do NOT prove complete laboratory capture; partial coverage or imports remain a limitation.
- Missing groups, zero or small denominators, unequal windows, missing/invalid/uninterpretable results return explicit not-assessable reasons and null baseline/change/p-values.
- Even after within-period deduplication, the same patient may recur across periods. Ordinary Fisher inference assumes independent observations. Groups with any repeated eligible patient across the four windows are withheld; identifiers used for this check never leave the server.
- Deduplication is patient × organism within each period after cohort filters, not independently per antibiotic/ward/specimen. Antibiotic eligibility follows first-isolate selection: a later S/R cannot replace an earlier I or missing result. Repeated historical-to-historical patients also violate the Fisher table's independence. I-only recurrence does not repeat an eligible binary observation.
- Keep this gate rather than reassigning or removing patients across windows: such subsetting would change the specified per-period cohort, counts, percentages and possibly minimum eligibility. A separately approved longitudinal or independent-subset policy would be needed; a wish for assessable groups is not approval of a different population or test.
- I and within-period repeat exclusions alone are not data errors. No source writes, dedup changes, or marker inference.
- IDs for returned assessments are deterministic **group + current period** keys containing no observation identifiers. One assessment per group; there is no persistent notification system and no duplicate alert insertion.

## Limitations
Fisher assumes independent binary observations and a comparable/exchangeable historical baseline. Changing case mix, laboratory practices, seasonality and serial outbreaks can invalidate this assumption. Equal windows and safety gates do not establish exchangeability. Pooled short-term history is provisional, not seasonally adjusted. Existing mixed-growth and cohort-selection policies remain unapproved. The conservative overlap/quality gates may mean no groups can be tested in real data; this is an explicit inability to assess, NOT evidence that nothing changed.

Holm covers only the family in one selected cohort/request; it does not correct repeated requests, trying different filters, or ongoing weekly monitoring. Treat exploratory signals as review prompts; a validated longitudinal/cluster-aware surveillance policy is needed before clinical use. No claim of outbreak, transmission, causation, or treatment recommendation is made.

## API
`GET /api/public/aei/anomalies` uses the same bearer authentication and admin/importer/viewer authorization as resistance reads, same period/isoYear/isoWeek/policy and repeatable organism/antibiotic/ward/specimen parameters. Unknown, repeated scalar and invalid parameters are rejected. No count/groupBy overrides.

Response `{ data: { status, period, policy, anomalies, assessments, testedGroups, insufficientGroups } }`:
- status: `anomalies-detected`, `no-anomalies` (only tested groups), `insufficient-data`, or `no-data`.
- each assessment: stable id, dimensions, current period/counts/rate/95% interval, three historical periods/counts, pooled baseline, percentage-point change, raw/adjusted p, status/reason/confidenceStatus.
- counts: resistant, susceptible, intermediate, eligible, missing, invalid, uninterpretable, repeated, rate, interval95.
- Aggregate diagnostics additionally return `selectedPatients`, `eligiblePatients` for each period and `overlappingPatients` (distinct eligible patients occurring in two or more windows for the same group). Diagnostics are calculated even when an earlier sample gate withholds inference. The primary reason follows the documented gate order; it is not a claim that no secondary blockers exist. Patient identifiers never appear in responses.
- The dashboard hides Intermediate as requested, but preserves it separately in engine/API counts. The overall not-assessable message is cause-neutral, with visible primary-reason counts and individual explanations. Assessed negatives retain a separate expandable list with their current and baseline values.
- `anomalies` is empty when none are detected; `assessments` retains explicit insufficient outcomes. Responses are private/no-store, aggregate-only. Operational errors are generic 503; invalid query 400; signed out 401; no role 403.

## Tests
`bunx vitest run` runs the synthetic engine, API, UI-state and existing Checkpoints 2–6 regression tests. Real data is never modified for test signals.
