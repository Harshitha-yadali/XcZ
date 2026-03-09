import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface JobFormData {
  company_name?: string;
  company_logo_url?: string;
  role_title?: string;
  package_amount?: number;
  package_type?: string;
  domain?: string;
  location_type?: string;
  location_city?: string;
  experience_required?: string;
  qualification?: string;
  eligible_years?: string;
  skills?: string;
  short_description?: string;
  full_description?: string;
  application_link?: string;
  is_active?: boolean;
}

interface UseJobFormAutoSaveOptions {
  formData: JobFormData;
  enabled: boolean;
  debounceMs?: number;
}

interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  error: string | null;
}

let draftTableSupported = true;
let didWarnDraftTableFallback = false;

const isMissingDraftTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';

  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.toLowerCase().includes('job_listing_drafts')
  );
};

const warnDraftTableFallback = () => {
  if (didWarnDraftTableFallback) return;
  didWarnDraftTableFallback = true;
  console.warn('job_listing_drafts table is not available. Falling back to local draft storage only.');
};

const getLocalDraftKey = (userId: string) => `job_draft_${userId}`;

export const useJobFormAutoSave = ({
  formData,
  enabled,
  debounceMs = 2000,
}: UseJobFormAutoSaveOptions) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    status: 'idle',
    lastSaved: null,
    error: null,
  });
  const [draftId, setDraftId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<string>('');

  const saveDraft = useCallback(async (data: JobFormData) => {
    try {
      setSaveStatus(prev => ({ ...prev, status: 'saving', error: null }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const dataString = JSON.stringify(data);

      if (dataString === previousDataRef.current) {
        setSaveStatus(prev => ({ ...prev, status: 'saved' }));
        return;
      }

      previousDataRef.current = dataString;

      if (!draftTableSupported) {
        localStorage.setItem(getLocalDraftKey(user.id), dataString);
        setSaveStatus({
          status: 'saved',
          lastSaved: new Date(),
          error: null,
        });
        return;
      }

      if (draftId) {
        const { error } = await supabase
          .from('job_listing_drafts')
          .update({
            form_data: data,
            last_saved_at: new Date().toISOString(),
          })
          .eq('id', draftId);

        if (error) throw error;
      } else {
        const { data: newDraft, error } = await supabase
          .from('job_listing_drafts')
          .insert({
            admin_user_id: user.id,
            form_data: data,
          })
          .select()
          .single();

        if (error) throw error;
        if (newDraft) setDraftId(newDraft.id);
      }

      const now = new Date();
      setSaveStatus({
        status: 'saved',
        lastSaved: now,
        error: null,
      });

      localStorage.setItem(getLocalDraftKey(user.id), dataString);
    } catch (error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (isMissingDraftTableError(error)) {
        draftTableSupported = false;
        warnDraftTableFallback();

        if (user) {
          localStorage.setItem(getLocalDraftKey(user.id), JSON.stringify(data));
        }

        setSaveStatus({
          status: 'saved',
          lastSaved: new Date(),
          error: null,
        });
        return;
      }

      console.error('Error saving draft:', error);
      setSaveStatus({
        status: 'error',
        lastSaved: null,
        error: error instanceof Error ? error.message : 'Failed to save draft',
      });

      if (user) {
        localStorage.setItem(getLocalDraftKey(user.id), JSON.stringify(data));
      }
    }
  }, [draftId]);

  const loadDraft = useCallback(async (): Promise<JobFormData | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      if (!draftTableSupported) {
        const localDraft = localStorage.getItem(getLocalDraftKey(user.id));
        return localDraft ? JSON.parse(localDraft) as JobFormData : null;
      }

      const { data: drafts, error } = await supabase
        .from('job_listing_drafts')
        .select('*')
        .eq('admin_user_id', user.id)
        .order('last_saved_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (drafts && drafts.length > 0) {
        const draft = drafts[0];
        setDraftId(draft.id);
        setSaveStatus({
          status: 'saved',
          lastSaved: new Date(draft.last_saved_at),
          error: null,
        });
        return draft.form_data as JobFormData;
      }

      const localDraft = localStorage.getItem(getLocalDraftKey(user.id));
      if (localDraft) {
        return JSON.parse(localDraft) as JobFormData;
      }

      return null;
    } catch (error) {
      if (isMissingDraftTableError(error)) {
        draftTableSupported = false;
        warnDraftTableFallback();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const localDraft = localStorage.getItem(getLocalDraftKey(user.id));
        return localDraft ? JSON.parse(localDraft) as JobFormData : null;
      }

      console.error('Error loading draft:', error);
      return null;
    }
  }, []);

  const deleteDraft = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (draftTableSupported && draftId) {
        await supabase
          .from('job_listing_drafts')
          .delete()
          .eq('id', draftId);
      }

      localStorage.removeItem(getLocalDraftKey(user.id));
      setDraftId(null);
      setSaveStatus({
        status: 'idle',
        lastSaved: null,
        error: null,
      });
      previousDataRef.current = '';
    } catch (error) {
      if (isMissingDraftTableError(error)) {
        draftTableSupported = false;
        warnDraftTableFallback();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          localStorage.removeItem(getLocalDraftKey(user.id));
        }
        setDraftId(null);
        setSaveStatus({
          status: 'idle',
          lastSaved: null,
          error: null,
        });
        previousDataRef.current = '';
        return;
      }

      console.error('Error deleting draft:', error);
    }
  }, [draftId]);

  const clearDraft = useCallback(() => {
    deleteDraft();
  }, [deleteDraft]);

  useEffect(() => {
    if (!enabled || !formData) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const hasData = Object.values(formData).some(value =>
        value !== undefined && value !== '' && value !== null
      );

      if (hasData) {
        saveDraft(formData);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [formData, enabled, debounceMs, saveDraft]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus.status === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus.status]);

  return {
    saveStatus,
    loadDraft,
    deleteDraft,
    clearDraft,
  };
};
