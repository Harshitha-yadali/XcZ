/*
  # Answers given for one application

  Belongs with 20261027120000_auto_apply_background_worker.sql and is separate
  only because that migration had already been applied when this column was
  added; an applied migration is never re-run.

  An answer to an ordinary question is remembered on the profile, so the same
  question is not asked on the next job. An answer to a checkbox is not: a tick
  against one employer's declaration authorises that application and nothing
  else, and remembering it would tick the next employer's similarly worded box
  unasked. Those answers are kept here instead, and the worker lays them over
  the remembered ones for that run only.
*/

ALTER TABLE auto_apply_applications
  ADD COLUMN IF NOT EXISTS given_answers jsonb DEFAULT '{}'::jsonb;
