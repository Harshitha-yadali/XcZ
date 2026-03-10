import { supabase } from '../lib/supabase';
import type { JobListing, JobUpdate, JobUpdateCategory, JobUpdateMetadata } from '../types/jobs';

export class JobUpdatesService {
  private static readonly WHATSAPP_SOURCE_PLATFORM = 'primo_whatsapp_auto';
  private static readonly WHATSAPP_JOB_KIND = 'whatsapp_job_card';

  async getAllUpdates(activeOnly: boolean = false): Promise<JobUpdate[]> {
    let query = supabase
      .from('job_updates')
      .select('*')
      .order('published_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getLatestUpdates(limit: number = 10): Promise<JobUpdate[]> {
    const { data, error } = await supabase
      .from('job_updates')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getFeaturedUpdates(): Promise<JobUpdate[]> {
    const { data, error } = await supabase
      .from('job_updates')
      .select('*')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data || [];
  }

  async getUpdatesByCategory(category: JobUpdateCategory): Promise<JobUpdate[]> {
    const { data, error } = await supabase
      .from('job_updates')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('published_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getUpdateById(id: string): Promise<JobUpdate | null> {
    const { data, error } = await supabase
      .from('job_updates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createUpdate(update: Omit<JobUpdate, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<JobUpdate> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('job_updates')
      .insert({
        ...update,
        created_by: userData?.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateUpdate(id: string, updates: Partial<JobUpdate>): Promise<JobUpdate> {
    const { data, error } = await supabase
      .from('job_updates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUpdate(id: string): Promise<void> {
    const { error } = await supabase
      .from('job_updates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleActive(id: string, isActive: boolean): Promise<JobUpdate> {
    return this.updateUpdate(id, { is_active: isActive });
  }

  async toggleFeatured(id: string, isFeatured: boolean): Promise<JobUpdate> {
    return this.updateUpdate(id, { is_featured: isFeatured });
  }

  isWhatsAppUpdate(update: JobUpdate): boolean {
    return update.source_platform === JobUpdatesService.WHATSAPP_SOURCE_PLATFORM;
  }

  async getWhatsAppUpdates(limit: number = 50, activeOnly: boolean = false): Promise<JobUpdate[]> {
    let query = supabase
      .from('job_updates')
      .select('*')
      .eq('source_platform', JobUpdatesService.WHATSAPP_SOURCE_PLATFORM)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('JobUpdatesService: Failed to load stored WhatsApp updates, using admin job fallback:', error);
    }

    const storedUpdates = error ? [] : (data || []);
    const fallbackUpdates = await this.getFallbackWhatsAppUpdatesFromJobs(limit, activeOnly);
    const merged = new Map<string, JobUpdate>();

    storedUpdates.forEach((update) => {
      merged.set(this.getWhatsAppJobKey(update), update);
    });

    fallbackUpdates.forEach((update) => {
      const key = this.getWhatsAppJobKey(update);
      if (!merged.has(key)) {
        merged.set(key, update);
      }
    });

    return Array.from(merged.values())
      .sort((left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime())
      .slice(0, limit);
  }

  private getWhatsAppJobKey(update: JobUpdate): string {
    const metadataJobId =
      typeof update.metadata?.job_id === 'string' && update.metadata.job_id.trim()
        ? update.metadata.job_id.trim()
        : '';

    return metadataJobId || update.id;
  }

  private normalizeEligibleYears(value: JobListing['eligible_years'] | undefined | null): string {
    if (!value) return 'Not specified';

    if (Array.isArray(value)) {
      const cleaned = value.map((item) => item.trim()).filter(Boolean);
      return cleaned.length ? cleaned.join(', ') : 'Not specified';
    }

    if (typeof value === 'string') {
      const normalized = value.includes(',') || value.includes('|') || value.includes('/')
        ? value.split(/[,|/]/)
        : value.split(/\s+/);
      const cleaned = normalized.map((item) => item.trim()).filter(Boolean);
      return cleaned.length ? cleaned.join(', ') : 'Not specified';
    }

    return 'Not specified';
  }

  private formatCompensationForShare(job: Pick<JobListing, 'package_amount' | 'package_type'>): string {
    const amount = typeof job.package_amount === 'number' ? job.package_amount : 0;
    if (amount <= 0) return 'Not disclosed';

    const packageType = (job.package_type || '').toLowerCase();
    if (packageType === 'stipend') {
      return `Rs.${Math.round(amount).toLocaleString('en-IN')} / month`;
    }
    if (packageType === 'hourly') {
      return `Rs.${Math.round(amount).toLocaleString('en-IN')} / hour`;
    }

    const inLakhs = amount / 100000;
    const formattedLakhs = Number.isInteger(inLakhs) ? inLakhs.toString() : inLakhs.toFixed(1);
    return `${formattedLakhs} LPA`;
  }

  private formatLocationForShare(job: Pick<JobListing, 'location_city' | 'location_type'>): string {
    if (job.location_city && job.location_city.trim()) {
      return `${job.location_city.trim()} (${job.location_type})`;
    }
    return job.location_type || 'Not specified';
  }

  private getPrimoBoostJobUrl(jobId: string): string {
    return `https://primoboostai.in/jobs/${jobId}`;
  }

  private buildVirtualWhatsAppUpdate(job: JobListing): JobUpdate {
    const packageText = this.formatCompensationForShare(job);
    const locationText = this.formatLocationForShare(job);
    const eligibleYearsText = this.normalizeEligibleYears(job.eligible_years);
    const experienceText =
      typeof job.experience_required === 'string' && job.experience_required.trim()
        ? job.experience_required.trim()
        : 'Not specified';
    const applyUrl = this.getPrimoBoostJobUrl(job.id);
    const content = [
      `Company Name: ${job.company_name}`,
      `Role: ${job.role_title}`,
      `Package: ${packageText}`,
      `Location: ${locationText}`,
      `Eligible Years: ${eligibleYearsText}`,
      `Experience: ${experienceText}`,
      `Apply Now: ${applyUrl}`,
    ].join('\n');

    return {
      id: `whatsapp-job-${job.id}`,
      title: `${job.company_name} hiring ${job.role_title}`,
      description: `${job.role_title} | ${packageText} | ${locationText} | ${eligibleYearsText} | ${experienceText}`,
      content,
      category: 'hiring_news',
      source_platform: JobUpdatesService.WHATSAPP_SOURCE_PLATFORM,
      metadata: {
        kind: JobUpdatesService.WHATSAPP_JOB_KIND,
        job_id: job.id,
        company_name: job.company_name,
        role_title: job.role_title,
        package: packageText,
        location: locationText,
        eligible_years: eligibleYearsText,
        experience_required: experienceText,
        apply_url: applyUrl,
        whatsapp_text: content,
        tags: ['whatsapp', 'job-update', (job.domain || 'job').toLowerCase().replace(/\s+/g, '-')],
        companies: [job.company_name],
        locations: [locationText],
      },
      external_link: applyUrl,
      is_featured: false,
      is_active: job.is_active,
      published_at: job.updated_at || job.posted_date || job.created_at,
      created_by: undefined,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  private async getFallbackWhatsAppUpdatesFromJobs(limit: number, activeOnly: boolean): Promise<JobUpdate[]> {
    let query = supabase
      .from('job_listings')
      .select(`
        id,
        company_name,
        role_title,
        package_amount,
        package_type,
        domain,
        location_type,
        location_city,
        experience_required,
        eligible_years,
        posted_date,
        created_at,
        updated_at,
        is_active,
        source_api
      `)
      .or('source_api.eq.manual_admin,source_api.like.manual_extract_%')
      .order('posted_date', { ascending: false })
      .limit(limit);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('JobUpdatesService: Failed to load admin jobs for WhatsApp fallback:', error);
      return [];
    }

    return (data || []).map((job) => this.buildVirtualWhatsAppUpdate(job as JobListing));
  }

  extractWhatsAppDetails(update: JobUpdate): {
    companyName: string;
    roleTitle: string;
    packageText: string;
    locationText: string;
    eligibleYears: string;
    experienceText: string;
    applyUrl: string;
  } {
    const metadata = update.metadata || {};
    const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

    const companyName =
      toText(metadata.company_name) ||
      toText(metadata.companyName) ||
      (Array.isArray(metadata.companies) && metadata.companies.length > 0 ? toText(metadata.companies[0]) : '');

    const roleTitle = toText(metadata.role_title) || toText(metadata.roleTitle);
    const packageText = toText(metadata.package) || toText(metadata.package_text);
    const locationText =
      toText(metadata.location) ||
      toText(metadata.location_text) ||
      (Array.isArray(metadata.locations) && metadata.locations.length > 0 ? toText(metadata.locations[0]) : '');
    const eligibleYears = toText(metadata.eligible_years) || toText(metadata.eligibleYears);
    const experienceText =
      toText(metadata.experience_required) ||
      toText(metadata.experience) ||
      toText(metadata.experience_text);
    const applyUrl = toText(metadata.apply_url) || toText(update.external_link);

    return {
      companyName: companyName || 'N/A',
      roleTitle: roleTitle || 'N/A',
      packageText: packageText || 'Not disclosed',
      locationText: locationText || 'Remote/Onsite',
      eligibleYears: eligibleYears || 'Not specified',
      experienceText: experienceText || 'Not specified',
      applyUrl,
    };
  }

  getWhatsAppMessage(update: JobUpdate): string {
    const details = this.extractWhatsAppDetails(update);
    const lines = [
      `Company Name: ${details.companyName}`,
      `Role: ${details.roleTitle}`,
      `Package: ${details.packageText}`,
      `Location: ${details.locationText}`,
      `Eligible Years: ${details.eligibleYears}`,
      `Experience: ${details.experienceText}`,
    ];

    if (details.applyUrl) {
      lines.push(`Apply Now: ${details.applyUrl}`);
    }

    return lines.join('\n');
  }

  getCategoryLabel(category: JobUpdateCategory): string {
    const labels: Record<JobUpdateCategory, string> = {
      market_trend: 'Market Trend',
      hiring_news: 'Hiring News',
      industry_update: 'Industry Update',
      platform_update: 'Platform Update',
      salary_insights: 'Salary Insights',
      skill_demand: 'Skill Demand'
    };
    return labels[category];
  }

  getCategoryColor(category: JobUpdateCategory): string {
    const colors: Record<JobUpdateCategory, string> = {
      market_trend: 'bg-blue-100 text-blue-800 border-blue-200',
      hiring_news: 'bg-green-100 text-green-800 border-green-200',
      industry_update: 'bg-purple-100 text-purple-800 border-purple-200',
      platform_update: 'bg-orange-100 text-orange-800 border-orange-200',
      salary_insights: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      skill_demand: 'bg-pink-100 text-pink-800 border-pink-200'
    };
    return colors[category];
  }

  validateMetadata(metadata: JobUpdateMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      JSON.stringify(metadata);
    } catch {
      errors.push('Invalid JSON format');
    }

    if (metadata.tags && !Array.isArray(metadata.tags)) {
      errors.push('Tags must be an array');
    }

    if (metadata.links && !Array.isArray(metadata.links)) {
      errors.push('Links must be an array');
    }

    if (metadata.links) {
      metadata.links.forEach((link, index) => {
        if (!link.title || !link.url) {
          errors.push(`Link ${index + 1} must have both title and url`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  generateDefaultMetadata(category: JobUpdateCategory): JobUpdateMetadata {
    const defaults: Record<JobUpdateCategory, JobUpdateMetadata> = {
      market_trend: {
        tags: ['trending', 'analysis'],
        stats: {}
      },
      hiring_news: {
        tags: ['hiring', 'opportunities'],
        companies: []
      },
      industry_update: {
        tags: ['industry', 'news']
      },
      platform_update: {
        tags: ['update', 'feature']
      },
      salary_insights: {
        tags: ['salary', 'compensation'],
        stats: {}
      },
      skill_demand: {
        tags: ['skills', 'demand'],
        stats: {}
      }
    };

    return defaults[category];
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    featured: number;
    byCategory: Record<JobUpdateCategory, number>;
  }> {
    const { data: updates, error } = await supabase
      .from('job_updates')
      .select('*');

    if (error) throw error;

    const stats = {
      total: updates?.length || 0,
      active: updates?.filter(u => u.is_active).length || 0,
      featured: updates?.filter(u => u.is_featured).length || 0,
      byCategory: {
        market_trend: 0,
        hiring_news: 0,
        industry_update: 0,
        platform_update: 0,
        salary_insights: 0,
        skill_demand: 0
      } as Record<JobUpdateCategory, number>
    };

    updates?.forEach(update => {
      if (update.category in stats.byCategory) {
        stats.byCategory[update.category as JobUpdateCategory]++;
      }
    });

    return stats;
  }
}

export const jobUpdatesService = new JobUpdatesService();
