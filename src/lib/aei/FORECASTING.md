# Checkpoint 7 — Weekly resistance forecasting

Replaces the anomaly dashboard and active anomaly service. The old authenticated endpoint returns 410. Pure anomaly calculations/tests and audit documents are retained as historical references only; they are not called by live APIs or the dashboard.

## API

`GET /api/public/aei/forecast` uses the same bearer identity validation and viewer/importer/admin roles as existing reporting. Query parameters: `period=annual|four-week`, `isoYear`, `isoWeek` required for four-week only, `policy=provisional-first-patient-organism-period`, exactly one `organism` and one `antibiotic`, optional existing `ward` and `specimen` filters. Unknown/repeated scalar filters are rejected. No patient/isolate identifiers are returned. Data is private/no-store.

The selected reporting window sets the as-of cutoff, capped at today and the global last imported sample date plus one day. The latest **complete seven-day Monday–Monday week** before this cutoff is the observed target. Annual selection uses the year's end; four-week selection uses its end, not its start. This is retrospective when the selected period is historical. Forecast is the immediately following week, not necessarily the next calendar week after today. Full source dates do not prove reporting completeness or absence of late results.

## Weekly series

At most 52 consecutive ISO weeks; no overlapping four-week values are relabeled as weekly. `calculateWeeklyResistance` delegates to the identical selection and eligibility implementation as existing calculations with only a seven-day window. Filter before deterministic patient × organism selection; selection before antibiotic eligibility. The first isolate is retained even when its antibiotic result is I/missing. Valid S/R form `R/(S+R)*100`; I is separate in API only. Minimum reportable denominator is the shared engine constant (30). No changes to stored data, four-week/annual policy, marker flags, imports or roles.

Missing, incomplete, below-minimum and missing/invalid/uninterpretable-result weeks stop the consecutive terminal training run. No interpolation, zero filling, or silent time compression. Reportable historical rates with exclusions remain visible but are not used for training. Cross-week patients can recur under the existing per-period rule: a predictive time series does not claim independent-patient Fisher inference. Serial dependence and changing patient mix can reduce generalization.

## Models and validation

- Last observed week's rate (baseline).
- Ordinary least squares linear regression on sequential week index using `simple-statistics`.
- Holt additive level/trend exponential smoothing. Initial level = first rate, trend = second − first. Alpha/beta grid each {0.2, 0.5, 0.8}, ties prefer first pair. Training-only inner expanding one-step validation starts after four observations; final Holt parameters are retuned on the full usable run.

Need at least eight training + four held-out weeks (12 consecutive usable weeks). All models forecast each of the final four weeks using only earlier values. For Holt, each fold tunes solely within that fold's training prefix. Lowest mean absolute error in percentage points wins; baseline wins ties, then regression. The selected model refits on all usable history to forecast one step. All model predictions are clipped to 0–100 both for validation and deployment; this constraint can improve measured error. Expose all three MAEs and concrete fold predictions in API, plus final Holt parameters, selected model, error and counts. No prediction intervals or claimed clinical accuracy.

The winning MAE is a **model-selection validation score**, not an independent final test score; four held-out weeks are a small noisy comparison and choosing the best model makes the winning score optimistic. No seasonality, case-mix adjustment, reporting-delay correction, patient-specific recommendations or validated uncertainty bounds. The minimum count does not guarantee precision. Dataset sparsity may honestly prevent forecasts for some selections.

## Response

`{data:{policy,status,results:[{dimensions,status,reason,latest,history,consecutiveWeeks,validation,forecast}]}}`. Each history week contains ISO week/year, start/end-exclusive, status, R/S/I counts, S+R denominator, reportable rate or null, excluded/missing/invalid counts. `validation` null and `forecast.rate` null when withheld. Missing data is never a zero rate. Dashboard hides I counts per existing user preference.

## Tests

`bunx vitest run` runs forecasting arithmetic, date boundaries/gaps, minimum samples, first-isolate eligibility, filters, temporal folds, API permissions/errors/privacy, bilingual UI states and previous-checkpoint regressions. Live verification results are recorded separately; synthetic tests do not establish real forecast accuracy.