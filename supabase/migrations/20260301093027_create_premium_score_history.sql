/*
  # Create Premium Score History Table

  1. New Tables
    - `premium_score_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `user_type` (text) - fresher, experienced, or student
      - `overall_score` (integer) - 0 to 100
      - `projected_score` (integer) - projected score after quick wins
      - `match_quality` (text) - match quality label
      - `shortlist_chance` (text) - shortlist probability
      - `job_title` (text) - target job title
      - `job_description_hash` (text) - hash of JD for deduplication
      - `category_scores` (jsonb) - full category breakdown
      - `skill_buckets` (jsonb) - must-have, supporting, missing, irrelevant
      - `red_flags_count` (integer) - number of red flags detected
      - `quick_wins_count` (integer) - number of quick wins suggested
      - `created_at` (timestamptz) - when the score was generated

  2. Security
    - Enable RLS on `premium_score_history` table
    - Add policy for authenticated users to read their own scores
    - Add policy for authenticated users to insert their own scores
*/

CREATE TABLE IF NOT EXISTS premium_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL DEFAULT 'fresher',
  overall_score integer NOT NULL DEFAULT 0,
  projected_score integer NOT NULL DEFAULT 0,
  match_quality text NOT NULL DEFAULT '',
  shortlist_chance text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '',
  job_description_hash text NOT NULL DEFAULT '',
  category_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  skill_buckets jsonb NOT NULL DEFAULT '{}'::jsonb,
  red_flags_count integer NOT NULL DEFAULT 0,
  quick_wins_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE premium_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own score history"
  ON premium_score_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON premium_score_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_premium_score_history_user_id
  ON premium_score_history(user_id);

CREATE INDEX IF NOT EXISTS idx_premium_score_history_created_at
  ON premium_score_history(created_at DESC);
