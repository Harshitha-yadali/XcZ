/*
  # Add scoring columns to optimization_sessions

  1. Modified Tables
    - `optimization_sessions`
      - Added `before_score` (integer) - overall score before optimization
      - Added `after_score` (integer) - overall score after optimization
      - Added `before_parameters` (jsonb) - 20-parameter scores before
      - Added `after_parameters` (jsonb) - 20-parameter scores after
      - Added `category_deltas` (jsonb) - category-level before/after deltas
      - Added `gap_classification` (jsonb) - fixable vs non-fixable gap data
      - Added `optimized_resume` (jsonb) - final optimized resume JSON
      - Added `changes_applied` (jsonb) - list of changes made
      - Added `iterations_count` (integer) - optimization loop count
      - Added `reached_target` (boolean) - whether 90+ was achieved
      - Added `processing_time_ms` (integer) - total processing time
      - Added `parsing_method` (text) - direct_text or ocr

  2. Security
    - No changes needed, RLS already enabled
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'before_score') THEN
    ALTER TABLE optimization_sessions ADD COLUMN before_score integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'after_score') THEN
    ALTER TABLE optimization_sessions ADD COLUMN after_score integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'before_parameters') THEN
    ALTER TABLE optimization_sessions ADD COLUMN before_parameters jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'after_parameters') THEN
    ALTER TABLE optimization_sessions ADD COLUMN after_parameters jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'category_deltas') THEN
    ALTER TABLE optimization_sessions ADD COLUMN category_deltas jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'gap_classification') THEN
    ALTER TABLE optimization_sessions ADD COLUMN gap_classification jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'optimized_resume') THEN
    ALTER TABLE optimization_sessions ADD COLUMN optimized_resume jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'changes_applied') THEN
    ALTER TABLE optimization_sessions ADD COLUMN changes_applied jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'iterations_count') THEN
    ALTER TABLE optimization_sessions ADD COLUMN iterations_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'reached_target') THEN
    ALTER TABLE optimization_sessions ADD COLUMN reached_target boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'processing_time_ms') THEN
    ALTER TABLE optimization_sessions ADD COLUMN processing_time_ms integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optimization_sessions' AND column_name = 'parsing_method') THEN
    ALTER TABLE optimization_sessions ADD COLUMN parsing_method text NOT NULL DEFAULT 'direct_text';
  END IF;
END $$;
