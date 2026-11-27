-- Where employer mail sent to the user's PrimoBoost job address is forwarded.
-- Empty means the account email (user_profiles.email_address).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS job_mail_to text
  CHECK (job_mail_to IS NULL OR (length(job_mail_to) <= 254 AND job_mail_to ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'));
