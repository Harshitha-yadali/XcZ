-- Longer sending window for the daily job email: every 10 minutes from 08:30
-- to 14:20 IST (03:00-08:50 UTC), 30 a run, so the ramp up to 1,000 a day fits.
select cron.alter_job(jobid, schedule := '*/10 3-8 * * *')
from cron.job where jobname = 'job-marketing-email';
