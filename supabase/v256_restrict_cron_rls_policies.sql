-- Lektrus v256: align cron RLS policies with the existing postgres-only
-- table grants. The extension policies should not target PUBLIC.
alter policy cron_job_policy on cron.job to postgres;
alter policy cron_job_run_details_policy on cron.job_run_details to postgres;
