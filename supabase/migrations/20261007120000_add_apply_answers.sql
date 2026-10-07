/*
  # Remember auto-apply answers

  Application forms ask things a resume does not say (work authorisation,
  notice period, how you heard about the job). The user answers once; the
  answer is stored here, keyed by the question's label, and reused on the
  next form that asks the same thing.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS apply_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
