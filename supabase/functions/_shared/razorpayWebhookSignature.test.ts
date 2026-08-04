import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyRazorpayWebhookSignature } from './razorpayWebhookSignature';

const secret = 'whsec_test_secret';

function sign(body: string, withSecret: string = secret): string {
  return createHmac('sha256', withSecret).update(body, 'utf8').digest('hex');
}

describe('verifyRazorpayWebhookSignature', () => {
  it('accepts a signature computed with the correct secret over the exact raw body', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });
    expect(verifyRazorpayWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    expect(verifyRazorpayWebhookSignature(body, sign(body, 'wrong_secret'), secret)).toBe(false);
  });

  it('rejects when the body has been tampered with after signing', () => {
    const original = JSON.stringify({ event: 'payment.captured', amount: 9900 });
    const signature = sign(original);
    const tampered = JSON.stringify({ event: 'payment.captured', amount: 990000 });
    expect(verifyRazorpayWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    expect(verifyRazorpayWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, '', secret)).toBe(false);
  });

  it('rejects when the webhook secret is not configured', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    expect(verifyRazorpayWebhookSignature(body, sign(body), undefined)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, sign(body), '')).toBe(false);
  });

  it('rejects a signature of a different length without throwing', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    expect(verifyRazorpayWebhookSignature(body, 'short', secret)).toBe(false);
  });
});
