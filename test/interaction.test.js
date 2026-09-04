import test from "node:test";
import assert from "node:assert/strict";

import { handleImageButtonKeydown } from "../src/interaction.js";

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
