import { supabase } from '../lib/supabaseClient';
import type { OptimizationSession } from '../types/optimization';

class OptimizationHistoryService {
  async getUserHistory(userId: string, limit: number = 15): Promise<OptimizationSession[]> {
    const { data, error } = await supabase
      .from('optimization_sessions')
      .select(
        'id, created_at, before_score, after_score, reached_target, processing_time_ms, changes_applied, iterations_count'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('OptimizationHistoryService: Failed to fetch history', error.message);
      return [];
    }
    return (data || []) as OptimizationSession[];
  }
}

export const optimizationHistoryService = new OptimizationHistoryService();
