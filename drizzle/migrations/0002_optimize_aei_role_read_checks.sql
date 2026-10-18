-- Evaluate the unchanged data-access predicate once per SQL statement rather than per source row.
ALTER POLICY "Role holders read" ON public.cultures USING ((SELECT public.has_any_role(auth.uid())));
ALTER POLICY "Role holders read" ON public.isolates USING ((SELECT public.has_any_role(auth.uid())));
ALTER POLICY "Role holders read" ON public.susceptibility_results USING ((SELECT public.has_any_role(auth.uid())));
-- Catalog discovery returns only organism names; invoker rights preserve table RLS.
CREATE OR REPLACE FUNCTION public.aei_organism_catalog() RETURNS TABLE(organism text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT DISTINCT i.organism FROM public.isolates i ORDER BY i.organism $$;
REVOKE ALL ON FUNCTION public.aei_organism_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aei_organism_catalog() TO authenticated, service_role;