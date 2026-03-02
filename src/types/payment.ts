export type PlanCategory = 'combined' | 'jd_only' | 'score_only' | 'combo';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  duration: string;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
  sessions: number;
  category: PlanCategory;
  tag: string;
  tagColor: string;
  gradient: string;
  icon: string;
  features: string[];
  popular?: boolean;
  durationInHours: number;
}


export interface PaymentData {
  planId: string;
  amount: number;
  currency: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  startDate: string;
  endDate: string;
  optimizationsUsed: number;
  optimizationsTotal: number;
  paymentId: string | null;
  couponUsed: string | null;
  scoreChecksUsed: number;
  scoreChecksTotal: number;
  linkedinMessagesUsed: number;
  linkedinMessagesTotal: number;
  guidedBuildsUsed: number;
  guidedBuildsTotal: number;
}

