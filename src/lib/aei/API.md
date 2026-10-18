# AEI JSON API — Checkpoint 5

All endpoints are **GET-only**, under `/api/public/aei`. This transport prefix bypasses the hosting site gate; **every endpoint except health verifies its own Bearer token and database role**. No patient/culture/isolate IDs are returned. No import writes are provided. Responses use `Cache-Control: private, no-store`. Cross-origin requests are not enabled.

## Endpoints

| Path | Access | Response |
|---|---|---|
| `/health` | Public | Application name, API version, process status, provisional clinical status. Liveness only, not a database readiness claim. |
| `/catalogs` | admin/importer/viewer | Database-backed organisms, bilingual antibiotic/ward/specimen labels, source date range, annual periods and available ISO-Monday four-week starts. Includes a database read check. |
| `/resistance/summary` | admin/importer/viewer | Per-organism/antibiotic aggregate results. |
| `/resistance/trends` | admin/importer/viewer | Ordered forward periods, each independently deduplicated and calculated. |
| `/resistance/breakdowns` | admin/importer/viewer | Organism/antibiotic plus optional ward/specimen dimensions. |
| `/data-quality` | admin/importer/viewer | Same calculation contract as summary, including exclusion counts and warnings; not a whole-database integrity audit. |
| `/imports` | admin/importer | Paginated stored import counters and status. No source messages, file names or user identifiers. |

Authentication header: `Authorization: Bearer <current app session access token>`. Never use a privileged database key. Accounts with no role are denied.

## Calculation query parameters

| Parameter | Required / permitted values |
|---|---|
| `period` | Required: `annual` or `four-week`. |
| `isoYear` | Required: integer 1900–2200. |
| `isoWeek` | Required only for four-week; valid week in that ISO year. |
| `policy` | Required literal `provisional-first-patient-organism-period`, explicit acknowledgment of the unconfirmed clinical policy. |
| `organism`, `antibiotic`, `ward`, `specimen` | Optional repeated parameters (not comma-separated), exact catalog names/codes, 1–100 values per dimension. Omitted means all. |
| `groupBy` | Breakdowns only; repeated dimensions. Must include `organism` and `antibiotic`, optionally `ward` and `specimen`. No duplicates. Default all four. |
| `count` | Trends only; forward windows from requested start. Default 1; maximum 5 annual or 13 four-week periods. |

Unknown parameters, malformed numbers, unsupported codes and repeated scalar parameters return 400. A valid period outside available data returns 200 with `status: "no-data"`, empty results and a `no-data` warning. Available periods may include partial data at source boundaries; dateRange exposes source coverage. Four-week starts in the catalog are weekly choices, not a final approved block alignment. Annual periods use ISO week-years, not calendar years.

Example (URL-encode organism spaces):

```text
GET /api/public/aei/resistance/summary?period=annual&isoYear=2024&organism=E.%20coli&antibiotic=AMP&policy=provisional-first-patient-organism-period
```

Trends add `count=3`; four-week requests use `period=four-week&isoYear=2024&isoWeek=52`. Four-week trends advance by 28 days, including year boundaries; annual trends advance by ISO year.

## Response contract

Summary, breakdowns and quality return `{ "data": { "period", "policy", "status", "warnings", "results" } }`. Trends return `{ "data": [same-period-envelope, ...], "direction": "forward", "count": N }`.

Each result contains `dimensions`, `period` (`kind`, `isoYear`, optional `isoWeek`, inclusive `start`, exclusive `endExclusive`), `resistantCount`, `susceptibleCount`, `intermediateCount`, `eligibleDenominator`, `selectedIsolateCount`, `percentage`, `dataQualityStatus`, `missingCount`, `invalidCount`, `uninterpretableCount`, `repeatedIsolateCount` and `warnings`.

`percentage` is the unrounded engine output **R/(S+R)×100**, or null below **30 S/R observations**. I remains separate and excluded from denominator. Status values: `zero-denominator`, `insufficient-data`, `reportable-with-exclusions`, `reportable`. Policy includes clinicalStatus `provisional`. Markers are not analyzed or derived. Traceability IDs remain inside the authenticated calculation engine and are omitted from this aggregate API.

Imports accept `limit` (1–100, default 20) and `offset` (0–1,000,000, default 0), and return `{data:[{id,dataset,status,rowsRead,rowsImported,rowsUpdated,rowsSkipped,rowsRejected,startedAt,finishedAt}],pagination:{limit,offset}}`. `rowsUpdated` is always 0: current imports never overwrite source rows. Import status must be checked; a running/failed report does not imply a completed import. Existing reports do not record validate/commit mode, so `validated` rows are not interpreted as inserted.

Errors: `{ "error": { "code": "...", "message": "..." } }`. 400 invalid query/filter/period, 401 missing/invalid/expired session, 403 insufficient role, 503 unavailable data/service. Non-GET methods are not registered and rejected by the router. Provider errors and credentials are never returned.

## Tests

```sh
bunx vitest run src/lib/aei/api.test.ts src/lib/aei/api-auth.test.ts src/lib/aei/resistance.test.ts
bunx vitest run
```

Unit tests inject synthetic observations and verified identities only in test code; production routes always read the existing database. They cover validation, access checks, empty data, minimum sample size, filters, trends, and equality with the calculation engine. Live verification uses a real authenticated session, without modifying source records.

## Unresolved decisions

Checkpoint 4 provisional first-patient/organism/period selection, filter-before-selection, tie ordering, mixed-growth eligibility, ISO-versus-calendar year, four-week alignment and threshold interpretation remain unapproved clinical decisions. API calls must acknowledge this. No new clinical policy is invented here. Reads are paginated and not a transaction snapshot: avoid concurrent imports for final reporting. Live checks verified signed-out denial and a signed-in account without a role; successful authorized database-backed API responses remain unverified because the current authenticated session has no data-access role (rechecked 2026-10-17 at 11:02 UTC). Representative summary, trend and breakdown requests all returned 403. Admin/importer/viewer access rules are covered by automated tests, not impersonated live users. No dashboard, anomalies or AI features added.