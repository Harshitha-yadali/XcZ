import { supabase } from '../lib/supabaseClient';
import type {
  ReferralListing,
  ReferralPricing,
  ReferralPurchase,
  ReferralConsultationSlot,
  ReferralSlotDisplayInfo,
  ReferralSlotType,
} from '../types/referral';

class ReferralService {
  async getActiveListings(): Promise<ReferralListing[]> {
    const { data, error } = await supabase
      .from('referral_listings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching listings:', error.message);
      return [];
    }
    return (data || []) as ReferralListing[];
  }

  async getAllListings(): Promise<ReferralListing[]> {
    const { data, error } = await supabase
      .from('referral_listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching all listings:', error.message);
      return [];
    }
    return (data || []) as ReferralListing[];
  }

  async getListingById(id: string): Promise<ReferralListing | null> {
    const { data, error } = await supabase
      .from('referral_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('ReferralService: Error fetching listing:', error.message);
      return null;
    }
    return data as ReferralListing | null;
  }

  async createListing(listing: Omit<ReferralListing, 'id' | 'created_at' | 'updated_at'>): Promise<ReferralListing | null> {
    const { data, error } = await supabase
      .from('referral_listings')
      .insert(listing)
      .select()
      .single();

    if (error) {
      console.error('ReferralService: Error creating listing:', error.message);
      return null;
    }
    return data as ReferralListing;
  }

  async updateListing(id: string, updates: Partial<ReferralListing>): Promise<boolean> {
    const { error } = await supabase
      .from('referral_listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('ReferralService: Error updating listing:', error.message);
      return false;
    }
    return true;
  }

  async deleteListing(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('referral_listings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('ReferralService: Error deleting listing:', error.message);
      return false;
    }
    return true;
  }

  async getPricing(): Promise<ReferralPricing | null> {
    const { data, error } = await supabase
      .from('referral_pricing')
      .select('*')
      .eq('id', '1')
      .maybeSingle();

    if (error) {
      console.error('ReferralService: Error fetching pricing:', error.message);
      return null;
    }
    return data as ReferralPricing | null;
  }

  async updatePricing(updates: Partial<ReferralPricing>): Promise<boolean> {
    const { error } = await supabase
      .from('referral_pricing')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', '1');

    if (error) {
      console.error('ReferralService: Error updating pricing:', error.message);
      return false;
    }
    return true;
  }

  async createPurchase(
    userId: string,
    listingId: string,
    purchaseType: 'query' | 'profile',
    amount: number
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('referral_purchases')
      .insert({
        user_id: userId,
        referral_listing_id: listingId,
        purchase_type: purchaseType,
        amount_paid: amount,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('ReferralService: Error creating purchase:', error.message);
      return null;
    }
    return data.id;
  }

  async updatePurchaseStatus(
    purchaseId: string,
    paymentId: string,
    orderId: string,
    status: 'success' | 'failed'
  ): Promise<boolean> {
    const { error } = await supabase
      .from('referral_purchases')
      .update({ payment_id: paymentId, order_id: orderId, status })
      .eq('id', purchaseId);

    if (error) {
      console.error('ReferralService: Error updating purchase:', error.message);
      return false;
    }
    return true;
  }

  async getUserPurchases(userId: string): Promise<ReferralPurchase[]> {
    const { data, error } = await supabase
      .from('referral_purchases')
      .select('*, referral_listings(*)')
      .eq('user_id', userId)
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching purchases:', error.message);
      return [];
    }
    return (data || []) as ReferralPurchase[];
  }

  async hasUserPurchased(userId: string, listingId: string, purchaseType: 'query' | 'profile'): Promise<boolean> {
    const { data, error } = await supabase
      .from('referral_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('referral_listing_id', listingId)
      .eq('purchase_type', purchaseType)
      .eq('status', 'success')
      .maybeSingle();

    if (error) return false;
    return !!data;
  }

  private getSlotDuration(slotType: ReferralSlotType): number {
    switch (slotType) {
      case 'profile': return 60;
      case 'query': return 15;
      case 'consultation': return 15;
      default: return 15;
    }
  }

  private formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayH}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  async getSlotsForDate(listingId: string, date: string, slotType: ReferralSlotType = 'consultation'): Promise<ReferralSlotDisplayInfo[]> {
    const startHour = 10;
    const startMin = 0;
    const duration = this.getSlotDuration(slotType);
    const cutoffMinutes = 16 * 60;
    const now = new Date();
    const todayStr = this.getLocalDateString(now);

    const timeSlots: string[] = [];
    let i = 0;
    while (true) {
      const totalMinStart = startHour * 60 + startMin + i * duration;
      const totalMinEnd = totalMinStart + duration;
      if (totalMinEnd > cutoffMinutes) break;
      const sH = String(Math.floor(totalMinStart / 60)).padStart(2, '0');
      const sM = String(totalMinStart % 60).padStart(2, '0');
      const eH = String(Math.floor(totalMinEnd / 60)).padStart(2, '0');
      const eM = String(totalMinEnd % 60).padStart(2, '0');
      timeSlots.push(`${sH}:${sM}-${eH}:${eM}`);
      i++;
    }

    const { data: existingSlots, error } = await supabase
      .from('referral_consultation_slots')
      .select('*')
      .eq('referral_listing_id', listingId)
      .eq('slot_date', date)
      .eq('slot_type', slotType);

    if (error) {
      console.error('ReferralService: Error fetching slots:', error.message);
      return [];
    }

    const slotMap: Record<string, ReferralConsultationSlot> = {};
    (existingSlots || []).forEach((s: ReferralConsultationSlot) => {
      slotMap[s.time_slot] = s;
    });

    const visibleSlots =
      date === todayStr ? timeSlots.filter((ts) => this.isTimeSlotInFuture(ts, now)) : timeSlots;

    return visibleSlots.map((ts) => {
      const existing = slotMap[ts];
      const [start, end] = ts.split('-');
      return {
        time_slot: ts,
        label: `${this.formatTime(start)} - ${this.formatTime(end)}`,
        status: existing?.status || 'available',
        slot_id: existing?.id,
      } as ReferralSlotDisplayInfo;
    });
  }

  async bookSlot(
    userId: string,
    listingId: string,
    date: string,
    timeSlot: string,
    slotType: ReferralSlotType,
    bookingPaymentId: string | null,
    userName: string,
    userEmail: string,
    userPhone?: string
  ): Promise<{ success: boolean; slotId?: string; error?: string }> {
    const { data: existing } = await supabase
      .from('referral_consultation_slots')
      .select('id')
      .eq('referral_listing_id', listingId)
      .eq('slot_date', date)
      .eq('time_slot', timeSlot)
      .eq('slot_type', slotType)
      .eq('status', 'booked')
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'This slot is already booked.' };
    }

    const { data, error } = await supabase
      .from('referral_consultation_slots')
      .insert({
        referral_listing_id: listingId,
        slot_date: date,
        time_slot: timeSlot,
        slot_type: slotType,
        status: 'booked',
        booked_by: userId,
        booking_payment_id: bookingPaymentId,
        user_name: userName,
        user_email: userEmail,
        user_phone: userPhone || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('ReferralService: Error booking slot:', error.message);
      return { success: false, error: 'Failed to book slot. Please try again.' };
    }

    return { success: true, slotId: data.id };
  }

  async getUserSlotBookings(userId: string): Promise<ReferralConsultationSlot[]> {
    const { data, error } = await supabase
      .from('referral_consultation_slots')
      .select('*')
      .eq('booked_by', userId)
      .eq('status', 'booked')
      .order('slot_date', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching bookings:', error.message);
      return [];
    }
    return (data || []) as ReferralConsultationSlot[];
  }

  async getAllPurchases(): Promise<ReferralPurchase[]> {
    const { data, error } = await supabase
      .from('referral_purchases')
      .select('*, referral_listings(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching all purchases:', error.message);
      return [];
    }
    return (data || []) as ReferralPurchase[];
  }

  private getLocalDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private isTimeSlotInFuture(timeSlot: string, now: Date): boolean {
    const [start] = timeSlot.split('-');
    const [h, m] = start.split(':').map((n) => parseInt(n, 10));
    const slotMinutes = h * 60 + (m || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return slotMinutes > currentMinutes;
  }
}

export const referralService = new ReferralService();
