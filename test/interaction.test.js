import test from "node:test";
import assert from "node:assert/strict";

import {
  getStepDeltaForKey,
  handleImageButtonKeydown,
  isCanvasInteractionTarget,
  isEditableTarget,
} from "../src/interaction.js";

test("allows Escape from an image button to reach the global image viewer handler", () => {
  let propagationStopped = false;

  handleImageButtonKeydown({
    key: "Escape",
    stopPropagation() {
      propagationStopped = true;
    },
  });

  assert.equal(propagationStopped, false);
});

test("isolates image activation keys from the parent node button", () => {
  for (const key of ["Enter", " "]) {
    let propagationStopped = false;

    handleImageButtonKeydown({
      key,
      stopPropagation() {
        propagationStopped = true;
      },
    });

    assert.equal(propagationStopped, true, `${JSON.stringify(key)} should be isolated`);
  }
});

test("starts canvas gestures only outside nodes and floating controls", () => {
  assert.equal(isCanvasInteractionTarget({ closest: () => null }), true);
  assert.equal(isCanvasInteractionTarget({ closest: () => ({}) }), false);
});

test("recognizes form and editable targets", () => {
  assert.equal(isEditableTarget({ matches: () => true }), true);
  assert.equal(isEditableTarget({ matches: () => false }), false);
});

test("maps presentation keys without stealing input controls", () => {
  const plainTarget = { matches: () => false };
  const editableTarget = { matches: () => true };
  const nodeButtonTarget = {
    matches: (selector) => selector.includes("[role='button']"),
  };

  assert.equal(getStepDeltaForKey({ key: "ArrowDown", shiftKey: false, target: plainTarget }), 1);
  assert.equal(getStepDeltaForKey({ key: " ", shiftKey: false, target: plainTarget }), 1);
  assert.equal(getStepDeltaForKey({ key: " ", shiftKey: true, target: plainTarget }), -1);
  assert.equal(getStepDeltaForKey({ key: "PageUp", shiftKey: false, target: plainTarget }), -1);
  assert.equal(getStepDeltaForKey({ key: "ArrowDown", shiftKey: false, target: editableTarget }), 0);
  assert.equal(getStepDeltaForKey({ key: " ", shiftKey: false, target: nodeButtonTarget }), 0);
});
