-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'importer', 'viewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.can_import(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','importer'))
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_import(uuid) TO authenticated;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Bootstrap: the very first account becomes admin; later accounts get no role (no data access) until an admin grants one.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_bootstrap_admin
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- Reference data
CREATE TABLE public.wards (
  ward_code text PRIMARY KEY,
  label_fi text NOT NULL,
  label_en text NOT NULL,
  ward_type text NOT NULL CHECK (ward_type IN ('in','out')),
  institution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.antibiotics (
  antibiotic_code text PRIMARY KEY,
  label_en text NOT NULL,
  label_fi text NOT NULL,
  drug_class text NOT NULL,
  reported_for text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.specimen_types (
  specimen_code text PRIMARY KEY,
  label_en text NOT NULL,
  label_fi text NOT NULL
);
INSERT INTO public.specimen_types VALUES
  ('urine','Urine','virtsa'),('blood','Blood','veri'),('wound','Wound','haava');

CREATE TABLE public.patients (
  patient_id text PRIMARY KEY,
  sex text,
  birth_year int CHECK (birth_year BETWEEN 1880 AND 2100),
  home_area text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cultures (
  culture_id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES public.patients(patient_id),
  age_years int,
  sample_date date NOT NULL,
  iso_year int NOT NULL,
  iso_week int NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  ward_code text NOT NULL REFERENCES public.wards(ward_code),
  admission_date date,
  specimen_code text NOT NULL REFERENCES public.specimen_types(specimen_code),
  result text NOT NULL CHECK (result IN ('positive','negative','mixed_growth')),
  n_isolates int NOT NULL CHECK (n_isolates >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cultures_patient_date_idx ON public.cultures (patient_id, sample_date);
CREATE INDEX cultures_ward_idx ON public.cultures (ward_code);
CREATE INDEX cultures_sample_date_idx ON public.cultures (sample_date);

-- Marker flags: true/false/NULL (NULL = unknown, never inferred)
CREATE TABLE public.isolates (
  isolate_id text PRIMARY KEY,
  culture_id text NOT NULL REFERENCES public.cultures(culture_id),
  isolate_no int NOT NULL,
  organism text NOT NULL,
  quantity text,
  esbl boolean,
  mrsa boolean,
  vre boolean,
  cpe boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (culture_id, isolate_no)
);
CREATE INDEX isolates_organism_idx ON public.isolates (organism);

CREATE TABLE public.susceptibility_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  isolate_id text NOT NULL REFERENCES public.isolates(isolate_id),
  antibiotic_code text NOT NULL REFERENCES public.antibiotics(antibiotic_code),
  result text NOT NULL CHECK (result IN ('S','I','R')),
  guideline text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (isolate_id, antibiotic_code)
);
CREATE INDEX susc_antibiotic_idx ON public.susceptibility_results (antibiotic_code);

CREATE TABLE public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset text NOT NULL,
  file_name text NOT NULL,
  started_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','validated','rejected','completed','failed')),
  rows_total int NOT NULL DEFAULT 0,
  rows_inserted int NOT NULL DEFAULT 0,
  rows_duplicate int NOT NULL DEFAULT 0,
  rows_rejected int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Grants
GRANT SELECT ON public.wards, public.antibiotics, public.specimen_types, public.patients,
  public.cultures, public.isolates, public.susceptibility_results, public.import_runs TO authenticated;
GRANT INSERT ON public.wards, public.antibiotics, public.patients, public.cultures,
  public.isolates, public.susceptibility_results, public.import_runs TO authenticated;
GRANT UPDATE ON public.import_runs TO authenticated;
GRANT ALL ON public.wards, public.antibiotics, public.specimen_types, public.patients,
  public.cultures, public.isolates, public.susceptibility_results, public.import_runs TO service_role;

-- RLS
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antibiotics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specimen_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isolates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.susceptibility_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role holders read" ON public.wards FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Role holders read" ON public.antibiotics FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Role holders read" ON public.specimen_types FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Role holders read" ON public.patients FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Role holders read" ON public.cultures FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Role holders read" ON public.isolates FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Role holders read" ON public.susceptibility_results FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Importers read runs" ON public.import_runs FOR SELECT TO authenticated USING (public.can_import(auth.uid()));

CREATE POLICY "Importers insert" ON public.wards FOR INSERT TO authenticated WITH CHECK (public.can_import(auth.uid()));
CREATE POLICY "Importers insert" ON public.antibiotics FOR INSERT TO authenticated WITH CHECK (public.can_import(auth.uid()));
CREATE POLICY "Importers insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.can_import(auth.uid()));
CREATE POLICY "Importers insert" ON public.cultures FOR INSERT TO authenticated WITH CHECK (public.can_import(auth.uid()));
CREATE POLICY "Importers insert" ON public.isolates FOR INSERT TO authenticated WITH CHECK (public.can_import(auth.uid()));
CREATE POLICY "Importers insert" ON public.susceptibility_results FOR INSERT TO authenticated WITH CHECK (public.can_import(auth.uid()));
CREATE POLICY "Importers insert runs" ON public.import_runs FOR INSERT TO authenticated
  WITH CHECK (public.can_import(auth.uid()) AND started_by = auth.uid());
CREATE POLICY "Importers update own runs" ON public.import_runs FOR UPDATE TO authenticated
  USING (public.can_import(auth.uid()) AND started_by = auth.uid());
