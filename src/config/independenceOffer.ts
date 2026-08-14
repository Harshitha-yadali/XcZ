// Independence Day offer config.
// The code + percentage MUST match the coupon row in Admin > Plan Coupons,
// otherwise the banner/overlay advertise a discount checkout will not honour.
export const INDEPENDENCE_OFFER = {
  code: 'FREEDOM75',
  discountPercentage: 75,
};

// Offer runs 11-15 Aug inclusive, ending 15 Aug 23:59:59 local time.
export const isIndependenceWindow = (now: Date = new Date()): boolean => {
  const date = now.getDate();
  return now.getMonth() === 7 && date >= 11 && date <= 15;
};
