// Rupee pricing for the Razorpay path. Deliberately kept free of any Node-only
// import (no `node:crypto`, unlike lib/v2/razorpay.ts) so the bundle page can
// import it in the browser and render the *same* rupee figure the server will
// actually charge — a display price derived independently from the charged
// price is how a checkout ends up quoting ₹450 and billing ₹500.
//
// Prices are derived from the existing USD list prices in lib/v2/reportModules.ts
// rather than maintained as a second hand-written table, so the bundle discount
// (all 4 modules for the price of 2) and every future price change flow through
// to INR automatically instead of silently drifting apart.
//
// The rate is a business setting, not a live FX feed: Razorpay charges whole
// rupees and a checkout price that moved with the spot rate would be unstable
// between page load and payment. Override with NEXT_PUBLIC_RAZORPAY_USD_TO_INR
// (must be NEXT_PUBLIC_ — both the browser's price label and the server's
// order amount read this, and they have to agree).
export const USD_TO_INR = Number(process.env.NEXT_PUBLIC_RAZORPAY_USD_TO_INR) || 90;

// Razorpay rejects any order below 100 paise (₹1).
export const MIN_RAZORPAY_PAISE = 100;

export function usdToInr(usd: number): number {
  return Math.round(usd * USD_TO_INR);
}

// Razorpay's Orders API takes the amount in the currency's smallest unit.
// Rounding to whole rupees first (rather than rounding paise) keeps the
// charged amount identical to the rupee figure shown on the button.
export function usdToPaise(usd: number): number {
  return usdToInr(usd) * 100;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
