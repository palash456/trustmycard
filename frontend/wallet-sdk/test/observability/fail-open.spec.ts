import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLogger } from "../../src/observability/logger";

describe("wallet-sdk observability fail-open", () => {
  it("createLogger.emit never throws when a sink fails", () => {
    let primaryRan = false;
    const logger = createLogger({
      module: "test",
      devMode: false,
      sinks: [
        () => {
          throw new Error("sink failed");
        },
        () => {
          primaryRan = true;
        },
      ],
    });

    assert.doesNotThrow(() =>
      logger.emit({
        level: "info",
        operation: "test",
        status: "success",
        message: "hello",
        skipSampling: true,
      })
    );
    assert.equal(primaryRan, true);
  });
});
