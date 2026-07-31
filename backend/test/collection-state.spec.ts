import assert from "node:assert/strict";
import test from "node:test";
import { CollectionIntentStatus, TransferAttemptStatus } from "@prisma/client";
import { assertIntentTransition, isFinalAttempt } from "../src/modules/collections/collection-state";

test("collection intent state machine permits queue execution lifecycle", () => {
  assert.doesNotThrow(() =>
    assertIntentTransition(CollectionIntentStatus.QUEUED, CollectionIntentStatus.EXECUTING)
  );
  assert.doesNotThrow(() =>
    assertIntentTransition(CollectionIntentStatus.EXECUTING, CollectionIntentStatus.BROADCAST)
  );
});

test("collection intent state machine rejects settlement rollback", () => {
  assert.throws(() =>
    assertIntentTransition(CollectionIntentStatus.SETTLED, CollectionIntentStatus.QUEUED)
  );
});

test("only terminal transfer attempt states are final", () => {
  assert.equal(isFinalAttempt(TransferAttemptStatus.CONFIRMED), true);
  assert.equal(isFinalAttempt(TransferAttemptStatus.FAILED), true);
  assert.equal(isFinalAttempt(TransferAttemptStatus.BROADCAST), false);
});
