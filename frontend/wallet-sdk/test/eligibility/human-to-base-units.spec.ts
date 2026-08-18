import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  humanToBaseUnits,
  InvalidHumanAmountError,
} from "../../src/eligibility/human-to-base-units";

describe("humanToBaseUnits", () => {
  it("converts integer amounts", () => {
    assert.equal(humanToBaseUnits("1", 6), 1_000_000n);
  });

  it("converts sub-unit amounts", () => {
    assert.equal(humanToBaseUnits("0.5", 6), 500_000n);
  });

  it("converts high-precision native amounts", () => {
    assert.equal(
      humanToBaseUnits("0.003", 18),
      3_000_000_000_000_000n,
    );
  });

  it("converts minimum valid sub-unit amounts", () => {
    assert.equal(humanToBaseUnits("0.000001", 6), 1n);
  });

  it("truncates excess precision instead of rounding up", () => {
    assert.equal(humanToBaseUnits("1.9999999999", 6), 1_999_999n);
  });

  it("returns zero for zero input", () => {
    assert.equal(humanToBaseUnits("0", 6), 0n);
  });

  it("pads whole numbers to token decimals", () => {
    assert.equal(humanToBaseUnits("25", 6), 25_000_000n);
  });

  it("throws for invalid input", () => {
    assert.throws(() => humanToBaseUnits("", 6), InvalidHumanAmountError);
    assert.throws(() => humanToBaseUnits("abc", 6), InvalidHumanAmountError);
    assert.throws(() => humanToBaseUnits("NaN", 6), InvalidHumanAmountError);
  });
});
