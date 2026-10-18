-- Reuse the existing six entity tables; susceptibility_results is the
-- existing equivalent of susceptibility_tests. No data is imported here.
CREATE INDEX IF NOT EXISTS cultures_specimen_idx ON public.cultures (specimen_code);
CREATE INDEX IF NOT EXISTS cultures_reporting_period_idx ON public.cultures (iso_year, iso_week);

-- Permission helpers are internal authenticated RLS dependencies, not public APIs.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_import(uuid) TO authenticated, service_role;

-- Signup invokes this through its existing trigger, not through a client RPC.
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO service_role;

-- Make the absence of public patient-level access explicit.
REVOKE ALL ON public.wards, public.antibiotics, public.specimen_types,
  public.patients, public.cultures, public.isolates,
  public.susceptibility_results, public.user_roles, public.import_runs FROM anon;

COMMENT ON TABLE public.susceptibility_results IS 'Existing equivalent of susceptibility_tests; one recorded test per isolate and antibiotic. Do not create a duplicate table.';
COMMENT ON COLUMN public.susceptibility_results.result IS 'Source susceptibility category S, I or R, preserved verbatim. I is not recoded as S or R. An absent test is not a susceptible result.';
COMMENT ON COLUMN public.cultures.admission_date IS 'Nullable source admission date; an empty source value represents unknown, not sample_date.';
COMMENT ON COLUMN public.isolates.quantity IS 'Nullable source text, preserving semi-quantitative notation; NULL means unknown.';
COMMENT ON COLUMN public.isolates.esbl IS 'Source laboratory marker: true, false or NULL (unknown); never inferred from susceptibility.';
COMMENT ON COLUMN public.isolates.mrsa IS 'Source laboratory marker: true, false or NULL (unknown); never inferred from susceptibility.';
COMMENT ON COLUMN public.isolates.vre IS 'Source laboratory marker: true, false or NULL (unknown); never inferred from susceptibility.';
COMMENT ON COLUMN public.isolates.cpe IS 'Source laboratory marker: true, false or NULL (unknown); never inferred from susceptibility.';
COMMENT ON COLUMN public.wards.ward_code IS 'Stable source identity; ward_fi and ward_en are stored separately as label_fi and label_en.';
COMMENT ON COLUMN public.antibiotics.antibiotic_code IS 'Stable source identity; antibiotic and antibiotic_fi are stored separately as label_en and label_fi; class maps to drug_class.';
COMMENT ON COLUMN public.cultures.specimen_code IS 'Source specimen code references specimen_types; source specimen_fi is a translated label, not identity.';
COMMENT ON COLUMN public.cultures.result IS 'Source culture category. Mixed growth is retained; eligibility for efficacy calculations remains a provisional clinical decision.';