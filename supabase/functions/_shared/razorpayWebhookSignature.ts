import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Razorpay webhook payload against its X-Razorpay-Signature header.
 * Must be computed over the raw request body text (not the parsed/re-stringified
 * JSON) since Razorpay signs the exact bytes it sent.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!signatureHeader || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signatureHeader, "utf8");

  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
