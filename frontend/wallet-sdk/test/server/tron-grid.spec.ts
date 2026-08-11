import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTronGridRateLimitMessage,
  tronGridHeaders,
} from "../../src/server/approvals/tron-grid";

describe("tron-grid client", () => {
  it("detects TronGrid public quota errors", () => {
    assert.equal(
      isTronGridRateLimitMessage(
        "request rate exceeded the allowed_rps(3), and the query server is suspended for 1 s",
      ),
      true,
    );
    assert.equal(isTronGridRateLimitMessage("contract validate error"), false);
  });

  it("adds TRON-PRO-API-KEY when configured", () => {
    const prev = process.env.TRONGRID_API_KEY;
    process.env.TRONGRID_API_KEY = "test-key";
    try {
      assert.equal(tronGridHeaders()["TRON-PRO-API-KEY"], "test-key");
    } finally {
      if (prev === undefined) delete process.env.TRONGRID_API_KEY;
      else process.env.TRONGRID_API_KEY = prev;
    }
  });
});
