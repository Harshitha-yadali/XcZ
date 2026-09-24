import { supabase } from '../lib/supabase';

export interface SoftwareTool {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  duration: string;
  price: number;
  original_price: number | null;
  buy_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SoftwareToolInput = Omit<SoftwareTool, 'id' | 'created_at' | 'updated_at'>;

export const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

export const softwareToolsService = {
  // RLS returns only active tools to non-admins, so admins and users share this query.
  async getTools(): Promise<SoftwareTool[]> {
    const { data, error } = await supabase
      .from('software_tools')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createTool(tool: SoftwareToolInput): Promise<void> {
    const { error } = await supabase.from('software_tools').insert(tool);
    if (error) throw error;
  },

  async updateTool(id: string, tool: Partial<SoftwareToolInput>): Promise<void> {
    const { error } = await supabase
      .from('software_tools')
      .update({ ...tool, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteTool(id: string): Promise<void> {
    const { error } = await supabase.from('software_tools').delete().eq('id', id);
    if (error) throw error;
  },
};
