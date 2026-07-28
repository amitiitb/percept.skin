import { describe, it, expect } from "vitest";
import { stripEmDash } from "./aiProvider";

// Standing site rule: no em dash anywhere in user-facing content. Claude's own
// generated text doesn't reliably obey the system-prompt instruction, so this
// sanitizer is the real enforcement point — cover it directly.
describe("stripEmDash", () => {
  it("replaces an em dash between words with a comma", () => {
    expect(stripEmDash("dry skin — needs hydration")).toBe("dry skin, needs hydration");
  });

  it("replaces multiple em dashes in one string", () => {
    expect(stripEmDash("a — b — c")).toBe("a, b, c");
  });

  it("leaves strings without an em dash untouched", () => {
    expect(stripEmDash("even, balanced tone")).toBe("even, balanced tone");
  });

  it("walks arrays of strings", () => {
    expect(stripEmDash(["fine lines — visible", "no change"])).toEqual(["fine lines, visible", "no change"]);
  });

  it("walks nested objects", () => {
    const input = { explanation: "mild redness — around the nose", nested: { note: "clear — even" } };
    expect(stripEmDash(input)).toEqual({ explanation: "mild redness, around the nose", nested: { note: "clear, even" } });
  });

  it("leaves non-string primitives untouched", () => {
    expect(stripEmDash(42)).toBe(42);
    expect(stripEmDash(null)).toBe(null);
    expect(stripEmDash(true)).toBe(true);
  });
});
