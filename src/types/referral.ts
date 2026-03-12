export interface ReferralListing {
  id: string;
  company_name: string;
  company_logo_url: string | null;
  role_title: string;
  experience_range: string;
  package_range: string;
  tech_stack: string[];
  job_description: string;
  location: string | null;
  referrer_name: string | null;
  referrer_designation: string | null;
  is_active: boolean;
  query_price: number | null;
  profile_price: number | null;
  slot_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralPricing {
  id: string;
  query_price: number;
  profile_price: number;
  slot_price: number;
  slot_duration_minutes: number;
  slot_start_time: string;
  slots_per_session: number;
  updated_at: string;
}

export interface ReferralSubmission {
  id: string;
  user_id: string;
  referral_listing_id: string;
  payment_transaction_id: string;
  applicant_name: string;
  contact_email: string;
  resume_file_name: string;
  resume_storage_path: string;
  amount_paid: number;
  admin_notified_at: string | null;
  status: 'submitted' | 'processing' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
  referral_listings?: ReferralListing;
}
