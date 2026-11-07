-- Every minute: nudge the API to retry any receipt/sale email that is due (and keep the function warm).
-- The endpoint is harmless to call: it only touches jobs that are already due and returns nothing.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule('studybg-sweep') where exists (select 1 from cron.job where jobname = 'studybg-sweep');
select cron.schedule(
  'studybg-sweep',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://lexvesszfuqqrateocap.supabase.co/functions/v1/studybg/api/internal/sweep',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 5000
     ) $$
);
