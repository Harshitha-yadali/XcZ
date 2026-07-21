import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: rpcMock },
}));

import { paymentService } from './paymentService';

describe('credit usage reservations', () => {
  beforeEach(() => rpcMock.mockReset());

  it.each(['quick', 'smart', 'deep'] as const)('reserves only the requested %s category', async (tier) => {
    rpcMock.mockResolvedValue({
      data: { success: true, reservation_id: `reservation-${tier}`, remaining: 4 },
      error: null,
    });

    const result = await paymentService.reserveOptimization('user-id', tier, `${tier}-run-123`);

    expect(result).toEqual(expect.objectContaining({ success: true, reservationId: `reservation-${tier}` }));
    expect(rpcMock).toHaveBeenCalledWith('reserve_user_credit', {
      p_request_key: `${tier}-run-123`,
      p_credit_type: 'optimization',
      p_quantity: 1,
      p_optimization_tier: tier,
    });
  });

  it('uses the score-check balance rather than Quick for JD score checker', async () => {
    rpcMock.mockResolvedValue({
      data: { success: true, reservation_id: 'reservation-score', remaining: 2 },
      error: null,
    });

    await paymentService.reserveScoreCheck('user-id', 'score-run-123');

    expect(rpcMock).toHaveBeenCalledWith('reserve_user_credit', expect.objectContaining({
      p_credit_type: 'score_check',
      p_optimization_tier: null,
    }));
  });

  it('calls the atomic refund operation for failed work', async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });
    expect(await paymentService.refundCreditReservation('reservation-id')).toEqual({ success: true, error: undefined });
    expect(rpcMock).toHaveBeenCalledWith('refund_user_credit_reservation', {
      p_reservation_id: 'reservation-id',
    });
  });
});
