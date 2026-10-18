# Checkpoint 4 resistance calculation policy

This engine is a provisional research calculation, not an approved clinical reporting policy. No challenge specification was provided beyond the conversation and six CSVs. Callers must explicitly send `provisional-first-patient-organism-period`; this acknowledgment is not clinical approval.

- Formula: R / (S + R) × 100. I is reported separately, excluded from the denominator. Minimum denominator is 30 distinct selected isolates with S/R for the specified antibiotic. I, missing, invalid and uninterpretable results cannot satisfy that threshold.
- Cohort: date range and requested organism/ward/specimen filters first; select the earliest isolate per patient and organism over the entire period, not separately within ward/specimen breakdowns. Tie-break: sample date, culture ID (lexical), isolate number, isolate ID. Collection times are unavailable. Selection is independent of antibiotic and S/I/R; an early missing or I result is not replaced by a later tested result.
- Annual means ISO week-year, from Monday of ISO week 1 through the next ISO week-year's Monday. It is not calendar year. Four-week means exactly 28 days from Monday of a caller-selected ISO week; windows may overlap and cross years. Fixed week blocks, rolling look-back windows and calendar annual reporting are not assumed.
- Positive and mixed-growth cultures with supplied organism-specific isolates are provisionally interpretable. Other culture-result categories are excluded. There is no explicit isolate-level interpretability field; clinical review of mixed growth remains necessary. Cultures without isolates do not become susceptibility observations.
- Missing count is no test row, null or empty result for a selected isolate and requested antibiotic. Invalid count includes other strings and duplicate antibiotic test rows. Counts apply after deduplication; repeated isolates and uninterpretable culture exclusions are counted separately. Markers are not read or inferred by this engine.
- Every result returns selected and denominator isolate IDs for authorized traceability, plus period boundaries, group dimensions, S/R/I counts, exclusions, denominator, percentage or null, data-quality status, and provisional policy metadata. The API enforces organism and antibiotic as separate dimensions.
- The authenticated caller must hold a data-access role; all reads use their RLS-scoped client. No writes, schema changes, public endpoints, or dashboard were added.
- Data reads are paginated in bounded concurrency. They are not a single transactional snapshot: avoid concurrent imports during final reporting, or approve a snapshot/database query implementation later.

## Decisions still requiring approval

Confirm challenge-specific first-isolate definition, whether susceptibility availability affects eligibility, stratification-before-selection, ISO versus calendar annual years, four-week alignment, threshold interpretation, and mixed-growth isolate interpretability. Current metadata makes these choices explicit; do not use output as a final clinical policy until approved.

## Guidance references (not a challenge specification)

- CLSI M39, cumulative susceptibility reporting: https://clsi.org/shop/standards/m39/
- WHO GLASS 2023 manual: https://iris.who.int/server/api/core/bitstreams/f671eb10-4ddd-419a-9ab1-173b8e8f6503/content
- EARS-Net reporting protocol: https://www.ecdc.europa.eu/sites/default/files/documents/EARS-Net-reporting-protocol-2026.pdf

These frameworks have different surveillance scopes. The conversation supplies the formula and threshold; guidance does not resolve this challenge's unprovided period/stratification rules.
