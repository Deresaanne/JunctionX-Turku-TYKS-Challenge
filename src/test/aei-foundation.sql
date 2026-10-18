-- Run with psql -X -v ON_ERROR_STOP=1 -f src/test/aei-foundation.sql.
-- Synthetic fixtures only; all changes roll back, including on connection close.
BEGIN;
DO $$
DECLARE
  t text;
  v text;
  admin_id uuid;
  unknown_id uuid := gen_random_uuid();
  prefix text := 'foundation-test-' || gen_random_uuid()::text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wards','antibiotics','patients','cultures','isolates','susceptibility_results'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'RLS missing on %', t;
    END IF;
    IF has_table_privilege('anon','public.'||t,'SELECT') OR has_table_privilege('anon','public.'||t,'INSERT') THEN
      RAISE EXCEPTION 'Public data access on %', t;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t
      AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[]
      AND qual LIKE '%has_any_role(auth.uid())%') THEN
      RAISE EXCEPTION 'Role-limited read policy missing on %', t;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t
      AND cmd='INSERT' AND roles=ARRAY['authenticated']::name[] AND with_check='can_import(auth.uid())') THEN
      RAISE EXCEPTION 'Importer-limited insert policy missing on %', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd IN ('ALL','UPDATE','DELETE')) THEN
      RAISE EXCEPTION 'Unexpected mutation policy on %', t;
    END IF;
  END LOOP;
  IF has_function_privilege('anon','public.can_import(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.has_any_role(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE')
    OR has_function_privilege('authenticated','public.bootstrap_first_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'Permission helper exposed to an unintended role';
  END IF;
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role='admin' LIMIT 1;
  IF admin_id IS NULL OR NOT has_function_privilege('authenticated','public.has_any_role(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.can_import(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Existing administrator and authenticated permission helpers are required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=unknown_id) THEN
    RAISE EXCEPTION 'Unassigned user fixture unexpectedly has a role';
  END IF;

  INSERT INTO public.wards (ward_code,label_fi,label_en,ward_type,institution)
    VALUES (prefix,'Testiosasto','Test ward','in','test');
  INSERT INTO public.antibiotics (antibiotic_code,label_en,label_fi,drug_class,reported_for)
    VALUES (prefix,'Test antibiotic','Testiantibiootti','test','test');
  INSERT INTO public.patients (patient_id) VALUES (prefix);
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE patient_id=prefix AND sex IS NULL AND birth_year IS NULL AND home_area IS NULL) THEN
    RAISE EXCEPTION 'Unknown patient fields must remain NULL';
  END IF;
  INSERT INTO public.cultures (culture_id,patient_id,sample_date,iso_year,iso_week,ward_code,specimen_code,result,n_isolates)
    SELECT prefix,prefix,DATE '2026-10-17',2026,42,prefix,specimen_code,'positive',3 FROM public.specimen_types LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM public.cultures WHERE culture_id=prefix AND admission_date IS NULL AND age_years IS NULL) THEN
    RAISE EXCEPTION 'Unknown admission date and age must remain NULL';
  END IF;
  FOREACH v IN ARRAY ARRAY['S','I','R'] LOOP
    INSERT INTO public.isolates (isolate_id,culture_id,isolate_no,organism)
      VALUES (prefix||v,prefix,array_position(ARRAY['S','I','R'],v),'test');
    INSERT INTO public.susceptibility_results (isolate_id,antibiotic_code,result,guideline)
      VALUES (prefix||v,prefix,v,'test');
    IF NOT EXISTS (SELECT 1 FROM public.susceptibility_results WHERE isolate_id=prefix||v AND result=v) THEN
      RAISE EXCEPTION 'Category % changed meaning',v;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.isolates WHERE isolate_id=prefix||'I' AND quantity IS NULL
    AND esbl IS NULL AND mrsa IS NULL AND vre IS NULL AND cpe IS NULL) THEN
    RAISE EXCEPTION 'Unknown quantities and laboratory markers must remain NULL';
  END IF;
  BEGIN
    INSERT INTO public.susceptibility_results (isolate_id,antibiotic_code,result,guideline)
      VALUES (prefix||'S',prefix,'SDD','test');
    RAISE EXCEPTION 'Invalid susceptibility category accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.susceptibility_results (isolate_id,antibiotic_code,result,guideline)
      VALUES (prefix||'S',prefix,'S','test');
    RAISE EXCEPTION 'Duplicate test accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.isolates (isolate_id,culture_id,isolate_no,organism)
      VALUES (prefix||'orphan',prefix||'missing',1,'test');
    RAISE EXCEPTION 'Orphan isolate accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS: RLS policy structure, public denial, role helpers, unknown fields, S/I/R, duplicate and orphan rejection';
END $$;
ROLLBACK;