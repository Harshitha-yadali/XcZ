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

export interface ReferralPurchase {
  id: string;
  user_id: string;
  referral_listing_id: string;
  purchase_type: 'query' | 'profile';
  amount_paid: number;
  payment_id: string | null;
  order_id: string | null;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
  referral_listings?: ReferralListing;
}

export type ReferralSlotType = 'query' | 'profile' | 'consultation';

export interface ReferralConsultationSlot {
  id: string;
  referral_listing_id: string;
  slot_date: string;
  time_slot: string;
  slot_type: ReferralSlotType;
  status: 'available' | 'booked' | 'blocked';
  booked_by: string | null;
  booking_payment_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralSlotDisplayInfo {
  time_slot: string;
  label: string;
  status: 'available' | 'booked' | 'blocked';
  slot_id?: string;
}
