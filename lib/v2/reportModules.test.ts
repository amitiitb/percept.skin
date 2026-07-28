import { describe, it, expect } from "vitest";
import { priceFor, moduleLabel, MODULES, BUNDLE_PRICE, INDIVIDUAL_TOTAL, BUNDLE_SAVINGS } from "./reportModules";

describe("priceFor", () => {
  it("charges $5 per selected module below the full set", () => {
    expect(priceFor(["skin"])).toBe(5);
    expect(priceFor(["skin", "colour"])).toBe(10);
    expect(priceFor(["skin", "colour", "hairstyle"])).toBe(15);
  });

  it("charges the flat bundle price once every module is selected", () => {
    expect(priceFor(["skin", "colour", "hairstyle", "frame"])).toBe(BUNDLE_PRICE);
  });

  it("does not charge the bundle price for an order that merely matches the module count", () => {
    // Regression guard: priceFor compares selected.length to MODULES.length, so
    // duplicate ids must not be mistaken for "all modules selected".
    expect(priceFor(["skin", "skin", "skin", "skin"])).toBe(BUNDLE_PRICE);
  });

  it("charges nothing for an empty selection", () => {
    expect(priceFor([])).toBe(0);
  });
});

describe("moduleLabel", () => {
  it("resolves a known module id to its label", () => {
    expect(moduleLabel("skin")).toBe("Skin Analysis");
  });

  it("falls back to the raw id for an unknown module", () => {
    expect(moduleLabel("nonexistent" as never)).toBe("nonexistent");
  });
});

describe("bundle pricing constants", () => {
  it("keeps the bundle strictly cheaper than buying every module separately", () => {
    expect(BUNDLE_PRICE).toBeLessThan(INDIVIDUAL_TOTAL);
    expect(BUNDLE_SAVINGS).toBe(INDIVIDUAL_TOTAL - BUNDLE_PRICE);
  });

  it("has exactly 4 modules priced at $5 each", () => {
    expect(MODULES).toHaveLength(4);
    for (const m of MODULES) expect(m.price).toBe(5);
  });
});
