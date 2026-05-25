
REVOKE EXECUTE ON FUNCTION public.delete_respondent_data(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_respondent_data(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_respondent_data(uuid) FROM anon;
