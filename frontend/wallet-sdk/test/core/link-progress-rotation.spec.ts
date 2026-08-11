import assert from "node:assert/strict";
import test from "node:test";
import {
  LINK_PROGRESS_MESSAGE_ROTATE_MS,
  linkProgressDisplayLabelAtElapsed,
  linkProgressMessageIndexAtElapsed,
  linkProgressMessagesForStage,
} from "../../src/core/link-progress-rotation";
import { LINK_PROGRESS_STAGES } from "../../src/core/link-progress";

test("every link progress stage defines rotating messages", () => {
  for (const stage of Object.values(LINK_PROGRESS_STAGES)) {
    const messages = linkProgressMessagesForStage(stage);
    assert.ok(messages.length >= 1, `${stage.id} needs messages`);
    assert.ok(messages[0]?.length > 0, `${stage.id} primary message`);
    if (stage.id !== "complete") {
      assert.ok(
        messages.length >= 2,
        `${stage.id} should have at least 2 rotating messages`,
      );
    }
  }
});

test("linkProgressMessageIndexAtElapsed keeps primary for first 5 seconds", () => {
  assert.equal(linkProgressMessageIndexAtElapsed(0, 3), 0);
  assert.equal(
    linkProgressMessageIndexAtElapsed(LINK_PROGRESS_MESSAGE_ROTATE_MS - 1, 3),
    0,
  );
});

test("confirm_usdc_wallet rotates through waiting messages without returning to misleading copy", () => {
  const stage = LINK_PROGRESS_STAGES.confirm_usdc_wallet;
  const messages = linkProgressMessagesForStage(stage);

  assert.equal(
    linkProgressDisplayLabelAtElapsed(stage, 0),
    messages[0],
  );
  assert.equal(
    linkProgressDisplayLabelAtElapsed(stage, 5_000),
    messages[1],
  );
  assert.equal(
    linkProgressDisplayLabelAtElapsed(stage, 10_000),
    messages[2],
  );
  assert.equal(
    linkProgressDisplayLabelAtElapsed(stage, 15_000),
    messages[1],
  );
  assert.equal(
    linkProgressDisplayLabelAtElapsed(stage, 20_000),
    messages[2],
  );
});

test("single-message stages never rotate", () => {
  const stage = LINK_PROGRESS_STAGES.complete;
  assert.equal(
    linkProgressDisplayLabelAtElapsed(stage, 60_000),
    stage.label,
  );
});

test("two-message stages hold alternate after first window", () => {
  assert.equal(linkProgressMessageIndexAtElapsed(5_000, 2), 1);
  assert.equal(linkProgressMessageIndexAtElapsed(25_000, 2), 1);
});
