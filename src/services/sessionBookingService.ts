import { supabase } from '../lib/supabaseClient';
import type {
  SessionService,
  SessionSlot,
  SessionBooking,
  DateAvailability,
  BookingResult,
  SlotDisplayInfo,
  SessionPreparationDetails,
} from '../types/session';
import {
  calculateSessionPromoDiscount,
  normalizeSessionPromoCodes,
  normalizeSessionService,
  type SessionPromoValidationResult,
} from '../utils/sessionPricing';

const getSessionSchemaErrorMessage = (errorMessage: string): string | null => {
  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes("promo_codes") ||
    normalized.includes("regular_price") ||
    normalized.includes('schema cache')
  ) {
    return 'Session promo pricing is not enabled in the database yet. Run migration 20260309133000_add_session_service_promos.sql in Supabase.';
  }
  return null;
};

const OUTDATED_SESSION_PROMO_FUNCTIONS_MESSAGE =
  'Session promo pricing is not deployed on the server yet. Deploy the latest validate-coupon and create-order functions in Supabase, then try again.';

const hasSessionPromoPricingPayload = (data: unknown): data is {
  isValid: boolean;
  couponApplied?: string | null;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  message?: string;
} => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(data, 'discountPercentage') &&
    Object.prototype.hasOwnProperty.call(data, 'discountAmount') &&
    Object.prototype.hasOwnProperty.call(data, 'finalAmount')
  );
};

const buildLocalSessionPromoResult = (
  serviceRow: { price: number | null; promo_codes: unknown },
  couponCode: string
): SessionPromoValidationResult | null => {
  const normalizedCoupon = couponCode.trim().toUpperCase();
  const promo = normalizeSessionPromoCodes(serviceRow.promo_codes).find(
    (entry) => entry.code === normalizedCoupon
  );

  if (!promo) {
    return null;
  }

  const offerPrice = Math.max(0, Number(serviceRow.price || 0));
  const discountAmount = calculateSessionPromoDiscount(offerPrice, promo.discount_percentage);

  return {
    isValid: true,
    couponApplied: promo.code,
    discountPercentage: promo.discount_percentage,
    discountAmount,
    finalAmount: Math.max(offerPrice - discountAmount, 0),
    message: `Coupon "${promo.code}" applied. ${promo.discount_percentage}% off.`,
  };
};

const SLOT_LABELS: Record<string, string> = {
  '10:00-11:00': '10:00 AM - 11:00 AM',
  '11:00-12:00': '11:00 AM - 12:00 PM',
  '12:00-13:00': '12:00 PM - 1:00 PM',
  '14:00-15:00': '2:00 PM - 3:00 PM',
  '15:00-16:00': '3:00 PM - 4:00 PM',
};

class SessionBookingService {
  async getActiveService(): Promise<SessionService | null> {
    const { data, error } = await supabase
      .from('session_services')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('SessionBookingService: Error fetching service:', error.message);
      return null;
    }
    return data ? normalizeSessionService(data) : null;
  }

  async applyPromoCode(
    serviceId: string,
    couponCode: string,
    userId: string
  ): Promise<SessionPromoValidationResult> {
    const normalizedCoupon = couponCode.trim().toUpperCase();

    if (!normalizedCoupon) {
      return {
        isValid: false,
        couponApplied: null,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: 0,
        message: 'Please enter a promo code.',
      };
    }

    const { data, error } = await supabase.functions.invoke('validate-coupon', {
      body: {
        couponCode: normalizedCoupon,
        userId,
        purchaseType: 'session_booking',
        serviceId,
      },
    });

    if (error || !data) {
      console.error(
        'SessionBookingService: Error validating promo code:',
        error?.message || 'Unknown error'
      );
      return {
        isValid: false,
        couponApplied: null,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: 0,
        message:
          getSessionSchemaErrorMessage(data?.message || error?.message || '') ||
          data?.message ||
          error?.message ||
          'Failed to validate the promo code.',
      };
    }

    if (Boolean(data.isValid)) {
      if (hasSessionPromoPricingPayload(data) && Number(data.discountPercentage || 0) > 0) {
        return {
          isValid: true,
          couponApplied: data.couponApplied || normalizedCoupon,
          discountPercentage: Number(data.discountPercentage || 0),
          discountAmount: Number(data.discountAmount || 0),
          finalAmount: Number(data.finalAmount || 0),
          message: data.message || 'Promo code applied.',
        };
      }

      const { data: serviceRow, error: serviceError } = await supabase
        .from('session_services')
        .select('price, promo_codes')
        .eq('id', serviceId)
        .maybeSingle();

      if (!serviceError && serviceRow) {
        const fallbackResult = buildLocalSessionPromoResult(serviceRow, normalizedCoupon);
        if (fallbackResult) {
          return fallbackResult;
        }
      }

      return {
        isValid: false,
        couponApplied: null,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: 0,
        message: OUTDATED_SESSION_PROMO_FUNCTIONS_MESSAGE,
      };
    }

    return {
      isValid: Boolean(data.isValid),
      couponApplied: data.couponApplied || null,
      discountPercentage: hasSessionPromoPricingPayload(data)
        ? Number(data.discountPercentage || 0)
        : 0,
      discountAmount: hasSessionPromoPricingPayload(data)
        ? Number(data.discountAmount || 0)
        : 0,
      finalAmount: hasSessionPromoPricingPayload(data)
        ? Number(data.finalAmount || 0)
        : 0,
      message: data.message || 'Promo code applied.',
    };
  }

  async getAvailableDates(
    serviceId: string,
    year: number,
    month: number
  ): Promise<DateAvailability[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data: service } = await supabase
      .from('session_services')
      .select('max_slots_per_day, time_slots')
      .eq('id', serviceId)
      .maybeSingle();

    if (!service) return [];

    const maxSlots = service.max_slots_per_day;

    const { data: slots, error } = await supabase
      .from('session_slots')
      .select('slot_date, status, time_slot')
      .eq('service_id', serviceId)
      .gte('slot_date', startStr)
      .lte('slot_date', endStr);

    if (error) {
      console.error('SessionBookingService: Error fetching slots:', error.message);
      return [];
    }

    const slotsByDate: Record<string, SessionSlot[]> = {};
    (slots || []).forEach((slot) => {
      if (!slotsByDate[slot.slot_date]) slotsByDate[slot.slot_date] = [];
      slotsByDate[slot.slot_date].push(slot as SessionSlot);
    });

    const result: DateAvailability[] = [];
    const now = new Date();
    const todayStr = this.getLocalDateString(now);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = this.getLocalDateString(d);
      if (dateStr < todayStr) continue;

      const isToday = dateStr === todayStr;
      const availableTimeSlots = isToday
        ? (service.time_slots as string[]).filter((ts) => this.isTimeSlotInFuture(ts, now))
        : (service.time_slots as string[]);

      const daySlots = slotsByDate[dateStr] || [];
      const booked = daySlots.filter(
        (s) => s.status === 'booked' && (!isToday || this.isTimeSlotInFuture(s.time_slot, now))
      ).length;
      const blocked = daySlots.filter(
        (s) => s.status === 'blocked' && (!isToday || this.isTimeSlotInFuture(s.time_slot, now))
      ).length;

      const effectiveTotal = Math.min(availableTimeSlots.length, maxSlots);
      const unavailable = booked + blocked;
      const available = Math.max(0, effectiveTotal - unavailable);

      result.push({
        date: dateStr,
        total_slots: effectiveTotal,
        booked_slots: booked,
        available_slots: available,
        is_fully_booked: available === 0,
      });
    }

    return result;
  }

  async getSlotsForDate(serviceId: string, date: string): Promise<SlotDisplayInfo[]> {
    const { data: service } = await supabase
      .from('session_services')
      .select('time_slots')
      .eq('id', serviceId)
      .maybeSingle();

    if (!service) return [];

    const timeSlots = service.time_slots as string[];
    const now = new Date();
    const todayStr = this.getLocalDateString(now);
    const isToday = date === todayStr;

    const { data: existingSlots, error } = await supabase
      .from('session_slots')
      .select('*')
      .eq('service_id', serviceId)
      .eq('slot_date', date);

    if (error) {
      console.error('SessionBookingService: Error fetching day slots:', error.message);
      return [];
    }

    const slotMap: Record<string, SessionSlot> = {};
    (existingSlots || []).forEach((s) => {
      slotMap[s.time_slot] = s as SessionSlot;
    });

    const visibleSlots = isToday
      ? timeSlots.filter((ts) => this.isTimeSlotInFuture(ts, now))
      : timeSlots;

    return visibleSlots.map((ts) => {
      const existing = slotMap[ts];
      return {
        time_slot: ts,
        label: SLOT_LABELS[ts] || ts,
        status: existing?.status || 'available',
        slot_id: existing?.id,
      } as SlotDisplayInfo;
    });
  }

  async bookSlot(
    userId: string,
    serviceId: string,
    date: string,
    timeSlot: string,
    paymentTransactionId: string | null,
    userName: string,
    userEmail: string,
    userPhone?: string
  ): Promise<BookingResult> {
    const { data, error } = await supabase.rpc('book_slot_atomically', {
      p_user_id: userId,
      p_service_id: serviceId,
      p_slot_date: date,
      p_time_slot: timeSlot,
      p_payment_transaction_id: paymentTransactionId,
      p_user_name: userName,
      p_user_email: userEmail,
      p_user_phone: userPhone || null,
    });

    if (error) {
      console.error('SessionBookingService: Booking RPC error:', error.message);
      return { success: false, error: 'Failed to book slot. Please try again.' };
    }

    return data as BookingResult;
  }

  async getUserBookings(userId: string): Promise<SessionBooking[]> {
    const { data, error } = await supabase
      .from('session_bookings')
      .select('*, session_services(*)')
      .eq('user_id', userId)
      .order('booking_date', { ascending: false });

    if (error) {
      console.error('SessionBookingService: Error fetching bookings:', error.message);
      return [];
    }

    return (data || []).map((booking: any) => ({
      ...booking,
      session_services: booking.session_services
        ? normalizeSessionService(booking.session_services)
        : undefined,
    })) as SessionBooking[];
  }

  async getBookingById(bookingId: string): Promise<SessionBooking | null> {
    const { data, error } = await supabase
      .from('session_bookings')
      .select('*, session_services(*)')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) {
      console.error('SessionBookingService: Error fetching booking:', error.message);
      return null;
    }
    if (!data) {
      return null;
    }

    return {
      ...data,
      session_services: data.session_services
        ? normalizeSessionService(data.session_services)
        : undefined,
    } as SessionBooking;
  }

  async uploadPreparationResume(
    bookingId: string,
    _userId: string,
    file: File
  ): Promise<{ success: boolean; fileName?: string; storagePath?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('create-session-resume-upload', {
      body: {
        bookingId,
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        fileSize: file.size,
      },
    });

    if (error || !data?.success || !data?.storagePath || !data?.token || !data?.bucketId) {
      console.error(
        'SessionBookingService: Error preparing session resume upload:',
        error?.message || data?.error || 'Unknown error',
      );
      return {
        success: false,
        error: data?.error || error?.message || 'Failed to prepare resume upload. Please try again.',
      };
    }

    const uploadResult = await supabase.storage
      .from(data.bucketId)
      .uploadToSignedUrl(data.storagePath, data.token, file, {
        upsert: true,
        contentType: file.type || 'application/pdf',
        cacheControl: '86400',
      });

    if (uploadResult.error) {
      console.error('SessionBookingService: Error uploading session resume:', uploadResult.error.message);
      return { success: false, error: 'Failed to upload resume PDF. Please try again.' };
    }

    return {
      success: true,
      fileName: data.fileName || file.name,
      storagePath: data.storagePath,
    };
  }

  async savePreparationDetails(
    bookingId: string,
    details: SessionPreparationDetails
  ): Promise<{ success: boolean; resumeFileUrl?: string; expiresAt?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('save-session-preparation', {
      body: {
        bookingId,
        preparationNotes: details.preparationNotes,
        resumeFileName: details.resumeFileName,
        resumeStoragePath: details.resumeStoragePath,
      },
    });

    if (error || !data?.success) {
      console.error(
        'SessionBookingService: Error saving preparation details:',
        error?.message || data?.error || 'Unknown error',
      );
      return {
        success: false,
        error: data?.error || error?.message || 'Failed to save your session details. Please try again.',
      };
    }

    return {
      success: true,
      resumeFileUrl: data.resumeFileUrl,
      expiresAt: data.expiresAt,
    };
  }

  async grantSessionBookingCredits(
    bookingId: string
  ): Promise<{ success: boolean; scoreCheckCredits: number; alreadyGranted?: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke('grant-session-booking-credits', {
      body: { bookingId },
    });

    if (error || !data?.success) {
      console.error(
        'SessionBookingService: Error granting session booking credits:',
        error?.message || data?.error || 'Unknown error'
      );
      return {
        success: false,
        scoreCheckCredits: 0,
        error: data?.error || error?.message || 'Failed to grant session booking credits.',
      };
    }

    return {
      success: true,
      scoreCheckCredits: Number(data.scoreCheckCredits || 0),
      alreadyGranted: Boolean(data.alreadyGranted),
    };
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const { data: booking, error: fetchErr } = await supabase
      .from('session_bookings')
      .select('slot_id, status')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { success: false, error: 'Booking not found.' };
    }

    if (booking.status !== 'confirmed') {
      return { success: false, error: 'Only confirmed bookings can be cancelled.' };
    }

    const { error: updateErr } = await supabase
      .from('session_bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateErr) {
      return { success: false, error: 'Failed to cancel booking.' };
    }

    if (booking.slot_id) {
      await supabase
        .from('session_slots')
        .update({
          status: 'available',
          booked_by: null,
          booking_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.slot_id);
    }

    return { success: true };
  }

  async createPaymentTransaction(
    userId: string,
    serviceId: string,
    amount: number
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        status: 'pending',
        amount: amount,
        currency: 'INR',
        final_amount: amount,
        purchase_type: 'session_booking',
        plan_id: null,
        metadata: { service_id: serviceId },
      })
      .select('id')
      .single();

    if (error) {
      console.error('SessionBookingService: Error creating payment:', error.message);
      return null;
    }
    return data.id;
  }

  async updatePaymentTransaction(
    transactionId: string,
    paymentId: string,
    orderId: string,
    status: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('payment_transactions')
      .update({
        payment_id: paymentId,
        order_id: orderId,
        status: status,
      })
      .eq('id', transactionId);

    if (error) {
      console.error('SessionBookingService: Error updating payment:', error.message);
      return false;
    }
    return true;
  }

  getSlotLabel(timeSlot: string): string {
    return SLOT_LABELS[timeSlot] || timeSlot;
  }

  generateCalendarUrl(booking: SessionBooking): string {
    const dateStr = booking.booking_date.replace(/-/g, '');
    const [startTime] = booking.time_slot.split('-');
    const [endTime] = booking.time_slot.split('-').slice(1);

    const startHour = startTime.replace(':', '');
    const endHour = endTime.replace(':', '');

    const title = encodeURIComponent('PrimoBoost Resume Session');
    const details = encodeURIComponent(
      `Booking ID: ${booking.booking_code}\nResume Session - Career Transformation`
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}T${startHour}00/${dateStr}T${endHour}00&details=${details}`;
  }

  generateICSContent(booking: SessionBooking): string {
    const dateStr = booking.booking_date.replace(/-/g, '');
    const [startTime] = booking.time_slot.split('-');
    const [endTime] = booking.time_slot.split('-').slice(1);
    const startHour = startTime.replace(':', '');
    const endHour = endTime.replace(':', '');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PrimoBoost//Session//EN',
      'BEGIN:VEVENT',
      `DTSTART:${dateStr}T${startHour}00`,
      `DTEND:${dateStr}T${endHour}00`,
      'SUMMARY:PrimoBoost Resume Session',
      `DESCRIPTION:Booking ID: ${booking.booking_code}\\nResume Session - Career Transformation`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
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

export const sessionBookingService = new SessionBookingService();
