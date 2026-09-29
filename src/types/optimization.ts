export interface OptimizationSession {
  id: string;
  user_id?: string;
  created_at: string;
  before_score?: number | null;
  after_score?: number | null;
  reached_target?: boolean | null;
  processing_time_ms?: number | null;
  changes_applied?: unknown[] | number | null; // jsonb array in DB
  iterations_count?: number | null;
}
