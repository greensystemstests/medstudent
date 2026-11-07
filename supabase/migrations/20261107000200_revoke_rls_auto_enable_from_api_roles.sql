-- Supabase's own helper that auto-enables RLS on new tables must not be callable through the public API (/rest/v1/rpc).
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
