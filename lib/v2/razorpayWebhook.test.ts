import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "./razorpay";

// The webhook is the only thing standing between "Razorpay says this order was
// paid" and a real unlock, so both directions matter: a genuine delivery must
// pass, and anything else must not. A verifier that rejects everything would
// have looked fine in a fail-closed smoke test while quietly making the whole
// safety net dead code.

const SECRET = "test_webhook_secret";
const BODY = JSON.stringify({ event: "order.paid", payload: { order: { entity: { id: "order_XYZ" } } } });

function sign(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const original = process.env.RAZORPAY_WEBHOOK_SECRET;
  beforeEach(() => { process.env.RAZORPAY_WEBHOOK_SECRET = SECRET; });
  afterEach(() => {
    if (original === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = original;
  });

  it("accepts a signature produced with the configured secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET))).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, "wrong_secret"))).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const signature = sign(BODY, SECRET);
    const tampered = BODY.replace("order_XYZ", "order_ATTACKER");
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a malformed signature rather than throwing on length mismatch", () => {
    expect(verifyWebhookSignature(BODY, "abc")).toBe(false);
  });

  // Fails closed: an unconfigured deployment must reject webhook traffic
  // rather than treat unverifiable deliveries as genuine.
  it("rejects everything when no webhook secret is configured", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSignature(BODY, sign(BODY, SECRET))).toBe(false);
  });
});
