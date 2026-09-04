import test from "node:test";
import assert from "node:assert/strict";

import {
  clampCamera,
  computeBounds,
  computeFitCamera,
  computeMinZoom,
  computePinchCamera,
  ensureRectVisible,
  panCamera,
  reconcileCamera,
  zoomCameraAt,
} from "../src/camera-model.js";

const closeTo = (actual, expected, tolerance = 0.001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
};

test("computes logical bounds from positioned node boxes", () => {
  assert.deepEqual(
    computeBounds([
      { x: 100, y: 100, width: 80, height: 40 },
      { x: 340, y: 260, width: 120, height: 100 },
    ]),
    { minX: 60, maxX: 400, minY: 80, maxY: 310 },
  );
});

test("fits tall content with 48px viewport padding", () => {
  const camera = computeFitCamera(
    { minX: 0, maxX: 1000, minY: 0, maxY: 2000 },
    { width: 1440, height: 900 },
    48,
  );

  assert.equal(camera.zoom, 0.402);
  closeTo(camera.x, -1291.045);
  closeTo(camera.y, -119.403);
});

test("allows zooming slightly farther out than fit view", () => {
  assert.equal(computeMinZoom(0.45), 0.405);
  assert.equal(computeMinZoom(0.9), 0.7);
  assert.equal(computeMinZoom(0.03), 0.05);
});

test("keeps the logical point under the pointer stable while zooming", () => {
  assert.deepEqual(zoomCameraAt({ x: 100, y: 50, zoom: 1 }, 0.5, { x: 200, y: 100 }), {
    x: -100,
    y: -50,
    zoom: 0.5,
  });
});

test("converts screen drag distance into logical camera pan", () => {
  assert.deepEqual(panCamera({ x: 100, y: 50, zoom: 0.5 }, { x: 80, y: -40 }), {
    x: -60,
    y: 130,
    zoom: 0.5,
  });
});

test("clamps pan while leaving at least 72px of content visible", () => {
  assert.deepEqual(
    clampCamera(
      { x: 5000, y: 5000, zoom: 1 },
      { minX: 0, maxX: 1000, minY: 0, maxY: 800 },
      { width: 1200, height: 800 },
      72,
    ),
    { x: 928, y: 728, zoom: 1 },
  );
});

test("does not move a camera when the target intersects the viewport", () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  assert.deepEqual(
    ensureRectVisible(camera, { minX: 1100, maxX: 1300, minY: 200, maxY: 400 }, { width: 1200, height: 800 }, 48),
    camera,
  );
});

test("moves only enough to reveal a target fully outside the viewport", () => {
  assert.deepEqual(
    ensureRectVisible(
      { x: 0, y: 0, zoom: 1 },
      { minX: 1500, maxX: 1700, minY: 200, maxY: 400 },
      { width: 1200, height: 800 },
      48,
    ),
    { x: 348, y: 0, zoom: 1 },
  );
});

test("preserves an already-valid user camera when content bounds expand", () => {
  const camera = { x: 100, y: 50, zoom: 0.8 };
  assert.deepEqual(
    reconcileCamera(
      camera,
      { minX: 0, maxX: 2400, minY: 0, maxY: 1600 },
      { minX: 400, maxX: 600, minY: 300, maxY: 500 },
      { width: 1200, height: 800 },
      { minVisiblePx: 72, targetPadding: 48 },
    ),
    camera,
  );
});

test("pinch zoom preserves the logical midpoint and follows midpoint translation", () => {
  const camera = computePinchCamera(
    { x: 100, y: 100, zoom: 1 },
    [{ x: 100, y: 100 }, { x: 300, y: 100 }],
    [{ x: 80, y: 140 }, { x: 320, y: 140 }],
  );

  closeTo(camera.x, 133.33333333333331);
  closeTo(camera.y, 83.33333333333333);
  assert.equal(camera.zoom, 1.2);
});
