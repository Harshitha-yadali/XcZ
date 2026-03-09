export type SlotStatus = 'available' | 'booked' | 'blocked';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface SessionPromoCode {
  code: string;
  discount_percentage: number;
  description?: string;
}

export interface SessionService {
  id: string;
  title: string;
  description: string;
  price: number;
  regular_price: number | null;
  currency: string;
  highlights: string[];
  promo_codes: SessionPromoCode[];
  bonus_credits: number;
  max_slots_per_day: number;
  time_slots: string[];
  meet_link: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionSlot {
  id: string;
  service_id: string;
  slot_date: string;
  time_slot: string;
  status: SlotStatus;
  booked_by: string | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionBooking {
  id: string;
  user_id: string;
  service_id: string;
  slot_id: string | null;
  booking_date: string;
  time_slot: string;
  payment_transaction_id: string | null;
  status: BookingStatus;
  bonus_credits_awarded: number;
  score_check_credits_awarded?: number | null;
  booking_code: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  preparation_notes?: string | null;
  resume_file_name?: string | null;
  resume_storage_path?: string | null;
  resume_public_url?: string | null;
  preparation_submitted_at?: string | null;
  resume_upload_expires_at?: string | null;
  score_check_credits_granted_at?: string | null;
  resume_deleted_at?: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  session_services?: SessionService;
}

export interface DateAvailability {
  date: string;
  total_slots: number;
  booked_slots: number;
  available_slots: number;
  is_fully_booked: boolean;
}

export interface BookingResult {
  success: boolean;
  booking_id?: string;
  booking_code?: string;
  slot_id?: string;
  bonus_credits?: number;
  score_check_credits?: number;
  error?: string;
}

export interface SessionPreparationDetails {
  preparationNotes: string;
  resumeFileName: string;
  resumeStoragePath: string;
}

export interface SlotDisplayInfo {
  time_slot: string;
  label: string;
  status: SlotStatus;
  slot_id?: string;
}

export interface BookingFlowState {
  service: SessionService | null;
  selectedDate: string | null;
  selectedSlot: string | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed';
  bookingResult: BookingResult | null;
}
