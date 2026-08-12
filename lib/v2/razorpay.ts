// Thin Razorpay REST wrapper — the rupee payment path for Indian users,
// alongside the existing USD PayPal path in lib/v2/paypal.ts.
//
// Plain HTTP, no SDK dependency, matching the house style set by paypal.ts:
// Razorpay's Orders API is REST with HTTP Basic auth, and checkout signature
// verification is a stock HMAC-SHA256 from Node's own `crypto`. The official
// `razorpay` npm package wraps exactly these two things, so pulling it in would
// add a dependency (and a second credential-loading convention) for no reach we
// don't already have. The browser side uses Razorpay's hosted checkout.js via a
// script tag, not an npm package — same arrangement as PayPal's hosted SDK.
//
// Test vs. live is selected by *which key pair is configured*, not by a URL:
// rzp_test_* keys and rzp_live_* keys both talk to api.razorpay.com and the
// account behind the key decides whether real money moves. There is therefore
// no sandbox/live base-URL swap to make here.
//
// Still outstanding before this is fully production-ready:
// - NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be from the same
//   Razorpay account/mode; the browser only ever sees the key id.
// - No webhook is registered. Fulfilment currently happens only on the
//   browser's verify call, so a payment where the user closes the tab between
//   Razorpay debiting them and our /verify request landing leaves money taken
//   with no purchase row. Razorpay's `order.paid` webhook (verified with
//   RAZORPAY_WEBHOOK_SECRET) closes that gap and is the recommended follow-up.

import crypto from "node:crypto";
import { MIN_RAZORPAY_PAISE } from "@/lib/v2/inrPricing";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

// Razorpay caps `receipt` at 40 characters and rejects longer values outright.
const RECEIPT_MAX_LENGTH = 40;

export class RazorpayApiError extends Error {
  // HTTP status Razorpay replied with, so callers can distinguish a
  // misconfigured key (401) from Razorpay being down (5xx).
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RazorpayApiError";
    this.status = status;
  }
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  // "created" until paid, "paid" once the full amount is captured, "attempted"
  // if a payment was tried and failed.
  status: string;
  receipt: string | null;
  notes: Record<string, string>;
}

// The key id is intentionally also exposed as NEXT_PUBLIC_ (the browser needs
// it to open checkout); the secret must never be read anywhere that can reach
// client-side code. Reading the non-public name first keeps the server working
// if only the unprefixed pair is configured.
function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new RazorpayApiError("Razorpay credentials not configured", 401);
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
}

function keySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new RazorpayApiError("Razorpay credentials not configured", 401);
  return secret;
}

// Razorpay returns errors as { error: { code, description, ... } }; surfacing
// the description makes a bad key or a rejected amount debuggable from logs
// instead of just "request failed: 400".
async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { error?: { description?: string; code?: string } } | null;
  return body?.error?.description ?? body?.error?.code ?? `HTTP ${res.status}`;
}

/**
 * Creates a Razorpay order. `notes` round-trips the buyer + what they bought,
 * so verification reads the purchase details back from Razorpay rather than
 * trusting a second client-supplied payload — the same defence-in-depth the
 * PayPal path gets from `custom_id`.
 */
export async function createOrder(
  amountPaise: number,
  receipt: string,
  notes: Record<string, string>,
): Promise<RazorpayOrder> {
  // Checked here rather than only at the call sites so every caller inherits
  // it; Razorpay would reject this anyway, but as an opaque 400 after a
  // needless round trip.
  if (!Number.isInteger(amountPaise) || amountPaise < MIN_RAZORPAY_PAISE) {
    throw new RazorpayApiError(`Amount must be a whole number of paise and at least ${MIN_RAZORPAY_PAISE}`, 400);
  }

  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: receipt.slice(0, RECEIPT_MAX_LENGTH),
      notes,
    }),
  });
  if (!res.ok) throw new RazorpayApiError(`Razorpay order creation failed: ${await readError(res)}`, res.status);
  return await res.json() as RazorpayOrder;
}

/**
 * Authoritative order state, straight from Razorpay. Verification reads
 * `status` and `notes` from here rather than from the browser's payload: the
 * checkout signature proves a payment belongs to an order, but only Razorpay
 * can say the order was actually paid in full and what it was for.
 */
export async function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) throw new RazorpayApiError(`Razorpay order lookup failed: ${await readError(res)}`, res.status);
  return await res.json() as RazorpayOrder;
}

/**
 * Verifies the handler payload Razorpay's checkout hands the browser:
 * HMAC-SHA256("<order_id>|<payment_id>") keyed with the account secret must
 * equal `razorpay_signature`. Only the secret holder can produce that, so a
 * match rules out a forged success callback.
 *
 * Compared with timingSafeEqual rather than `===` — a plain string compare
 * short-circuits on the first differing byte, which leaks enough timing to
 * forge a signature byte by byte.
 */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", keySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a rejection.
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
