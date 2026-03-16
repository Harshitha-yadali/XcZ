export interface PricingPlanCoupon {
  id: string;
  code: string;
  description: string;
  discountPercentage: number;
  applicablePlanIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface PricingPlanCouponInput {
  code: string;
  description: string;
  discountPercentage: number;
  applicablePlanIds: string[];
  isActive: boolean;
}
