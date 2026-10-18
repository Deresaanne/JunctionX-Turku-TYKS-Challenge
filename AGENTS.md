<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AEI project rules
- Forecasting uses a weekly adapter of the existing resistance engine and a pure model/temporal-validation module behind the shared authenticated aggregate API; why: weekly selection and eligibility stay consistent without changing four-week or annual reporting.
- Forecast model selection uses expanding-window held-out predictions with training-only Holt tuning and baseline tie preference; why: avoid temporal leakage and unvalidated accuracy claims. The retired anomaly endpoint returns authenticated 410; legacy pure anomaly tests remain as historical regression references, not active inference.
- Imports run through `src/lib/aei/imports.functions.ts`: browsers send original CSV text, and server-side `import-pipeline.ts` parses and validates whole files before `import-store.server.ts` writes batches using the authenticated client; why: callers cannot bypass full-file validation or supply authoritative counts.
- Row validation lives in pure `src/lib/aei/validation.ts` shared by client and server; why: one rule set, unit-testable.
- A file is fully validated before any insert; any error rejects it, and inserts never overwrite existing keys (ignore duplicates); why: reproducible, idempotent loads.
- Access: the resistance dashboard, aggregate read APIs and marker counts are public read-only (anonymous callers are treated as viewer and read server-side); imports, import reports and writes need admin/importer via `public.user_roles` and RLS; first sign-up becomes admin; why: public demo of synthetic data while writes stay protected.
- Stable internal codes are keys; translated labels live in `label_en`/`label_fi` columns or `src/lib/aei/i18n.tsx`; why: language never changes identity.
- Resistance marker flags are nullable booleans (NULL = unknown) and are never derived from susceptibility; why: lab flags are the source of truth.
- Reuse `public.susceptibility_results` as the equivalent of susceptibility_tests; why: a second table would split the same source records and break existing consumers.
- Database foundation regression checks live in `src/test/aei-foundation.sql` and use rollback-only synthetic fixtures; why: verify stored semantics and access rules without importing CSVs or retaining test data.
- Import reports use existing `import_runs`; inserts never update source records and counters are computed server-side; why: re-imports are idempotent and partial operational failures remain visible without new schema.
- Resistance calculations use a pure tested `resistance.ts` engine, an RLS-scoped `resistance.server.ts` reader, and an authenticated `resistance.functions.ts` endpoint; why: arithmetic stays testable and sensitive traceability never becomes public.
- Resistance outputs require explicit provisional policy acknowledgment and keep organism/antibiotic dimensions distinct; why: unconfirmed clinical policies and incompatible drug denominators must not be silently combined.
- AEI raw HTTP APIs use thin TanStack routes and a shared request handler with request-scoped bearer/RLS clients; why: external clients receive validated JSON without duplicating calculation or authorization rules.
- API responses omit observation identifiers and import source messages; trends reuse one observation read and the existing engine independently per period; why: aggregate access does not leak traceability and denominator policies remain consistent.
- Resistance table statuses use a presentation-only aggregate mapper and the engine's shared minimum-denominator constant; why: explanations cannot drift from calculation rules or mistake routine exclusions for data errors.
- Resistance reads use authenticated keyset-paged relational projections, left-embedded antibiotic tests, and an invoker-rights distinct catalog; statement-level role predicates preserve access while avoiding per-row checks and bulk lookup waterfalls.
