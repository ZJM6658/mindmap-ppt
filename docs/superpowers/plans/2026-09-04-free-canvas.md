# Free Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bounded free canvas that preserves presentation rhythm while replacing the current AI-styled page chrome with a Stitch-inspired professional workspace.

**Architecture:** Extract pure camera math into `src/camera-model.js`, then make `src/main.js` keep persistent camera state independent of the layout model. Pointer, wheel, pinch, navigation, and fit-view actions update the camera through one controller path; the DOM renderer only applies the resulting transform.

**Tech Stack:** Dependency-free HTML, CSS, browser JavaScript, Node.js built-in test runner, Playwright CLI for browser QA.

**Spec:** `docs/superpowers/specs/2026-09-04-free-canvas-design.md`

## Global Constraints

- Keep the project dependency-free at runtime.
- Preserve `@unit`, `@image`, and legacy node-by-node content behavior.
- The canvas must remain freely pannable and zoomable without ordinary renders resetting the user's view.
- New logic units only move the camera when completely outside the viewport, using the smallest movement that makes them visible.
- Fit view keeps at least 48 CSS pixels of viewport padding.
- Interactive zoom range is dynamic from `max(0.05, min(0.70, fitZoom * 0.90))` through `2.0`.
- The visual language uses a dark dotted workspace, paper-white nodes, solid dark controls, and cobalt as the only accent.
- Do not add glass effects, gradient blobs, letter grids, decorative eyebrow labels, orange/green state colors, or a minimap.

---

### Task 1: Pure camera model

**Files:**
- Create: `src/camera-model.js`
- Create: `test/camera-model.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `computeBounds(items)`, `computeFitCamera(bounds, viewport, padding)`, `computeMinZoom(fitZoom)`, `zoomCameraAt(camera, nextZoom, screenPoint)`, `panCamera(camera, screenDelta)`, `clampCamera(camera, bounds, viewport, minVisiblePx)`, `ensureRectVisible(camera, rect, viewport, padding)`, `reconcileCamera(camera, bounds, activeRect, viewport, options)`, and `computePinchCamera(startCamera, startTouches, currentTouches)`.
- Camera shape: `{ x: number, y: number, zoom: number }`, where `x/y` are the logical coordinates at the viewport's top-left.
- Bounds shape: `{ minX, maxX, minY, maxY }`; viewport shape: `{ width, height }`.

- [ ] **Step 1: Write failing fit and dynamic-zoom tests**

```js
test("fits tall content with 48px viewport padding", () => {
  const camera = computeFitCamera(
    { minX: 0, maxX: 1000, minY: 0, maxY: 2000 },
    { width: 1440, height: 900 },
    48,
  );
  assert.equal(camera.zoom, 0.402);
  assert.ok(Math.abs(camera.x + 1291.045) < 0.001);
  assert.ok(Math.abs(camera.y + 119.403) < 0.001);
});

test("allows zooming slightly farther out than fit view", () => {
  assert.equal(computeMinZoom(0.45), 0.405);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/camera-model.test.js`

Expected: FAIL because `src/camera-model.js` does not exist.

- [ ] **Step 3: Add pointer-stability, pan-boundary, and minimal-visibility tests**

```js
test("keeps the logical point under the pointer stable while zooming", () => {
  assert.deepEqual(zoomCameraAt({ x: 100, y: 50, zoom: 1 }, 0.5, { x: 200, y: 100 }), {
    x: -100,
    y: -50,
    zoom: 0.5,
  });
});

test("clamps pan while leaving at least 72px of content visible", () => {
  const camera = clampCamera(
    { x: 5000, y: 5000, zoom: 1 },
    { minX: 0, maxX: 1000, minY: 0, maxY: 800 },
    { width: 1200, height: 800 },
    72,
  );
  assert.deepEqual(camera, { x: 928, y: 728, zoom: 1 });
});

test("does not move a camera when the target intersects the viewport", () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  assert.deepEqual(
    ensureRectVisible(camera, { minX: 1100, maxX: 1300, minY: 200, maxY: 400 }, { width: 1200, height: 800 }, 48),
    camera,
  );
});
```

- [ ] **Step 4: Implement the pure camera functions**

Use finite-number guards, normalize zero-size bounds to one logical pixel, round only public zoom values to three decimals, and keep pan/zoom calculations unrounded.

- [ ] **Step 5: Run tests and syntax checks**

Run: `npm test && npm run check`

Expected: all tests pass and `src/camera-model.js` parses.

### Task 2: Persistent camera and fit view

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`
- Test: `test/camera-model.test.js`

**Interfaces:**
- Consumes all Task 1 camera functions.
- Produces DOM actions `fitView()`, `setCameraZoom(nextZoom, screenPoint)`, and `applyCameraTransform()` inside `src/main.js`; consumes `reconcileCamera` for layout changes.

- [ ] **Step 1: Write a failing regression test for `reconcileCamera` preserving state across bounds changes**

```js
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
```

- [ ] **Step 2: Verify the new test fails for the missing case**

Run: `node --test test/camera-model.test.js`

Expected: FAIL because `reconcileCamera` does not exist.

- [ ] **Step 3: Replace derived viewport rendering with persistent camera state**

Initialize the camera once from `computeFitCamera`. On later renders:

```js
const bounds = computeBounds(model.nodes);
if (!camera) camera = computeFitCamera(bounds, getViewportSize(), VIEW_PADDING);
camera = clampCamera(camera, bounds, getViewportSize(), MIN_VISIBLE_CONTENT);
if (activeNode) camera = ensureRectVisible(camera, nodeRect(activeNode), getViewportSize(), VIEW_PADDING);
applyCameraTransform();
```

Do not recalculate the camera from path centers during ordinary render calls.

- [ ] **Step 4: Add the fit-view control and dynamic zoom range**

Add `#fitViewButton`, set the zoom slider maximum to `200`, and update its minimum after each layout from `computeMinZoom(fitCamera.zoom) * 100`.

- [ ] **Step 5: Verify model and syntax tests**

Run: `npm test && npm run check`

Expected: all tests pass.

### Task 3: Desktop free-canvas interactions

**Files:**
- Modify: `src/main.js`
- Modify: `src/interaction.js`
- Modify: `test/interaction.test.js`

**Interfaces:**
- Produces: `isCanvasInteractionTarget(target)`, `isEditableTarget(target)`, and `getStepDeltaForKey(event)` in `src/interaction.js`.
- Consumes: persistent camera actions from Task 2.

- [ ] **Step 1: Write failing interaction-routing tests**

```js
test("space advances unless focus is on an interactive control", () => {
  assert.equal(getStepDeltaForKey({ key: " ", shiftKey: false, target: { matches: () => false } }), 1);
  assert.equal(getStepDeltaForKey({ key: " ", shiftKey: false, target: { matches: () => true } }), 0);
});

test("drag starts on canvas chrome but not on a node or control", () => {
  assert.equal(isCanvasInteractionTarget({ closest: () => null }), true);
  assert.equal(isCanvasInteractionTarget({ closest: () => ({}) }), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/interaction.test.js`

Expected: FAIL because the routing helpers do not exist.

- [ ] **Step 3: Implement pointer drag and wheel pan**

- Start pointer drag only when no `.mind-node`, `.floating-ui`, `.node-image`, or `.image-viewer` ancestor exists.
- Convert screen delta to logical delta with `panCamera`.
- Add `.is-panning` during drag and use pointer capture.
- Plain wheel pans; `Ctrl/Cmd + wheel` zooms around the pointer.
- Prevent browser scrolling only when the event operates on the canvas.

- [ ] **Step 4: Add presentation keyboard controls**

Support Arrow Up/Down, Page Up/Down, Space, and Shift+Space. Ignore editable and interactive controls. Keep all progress changes through `setActiveStepIndex()`.

- [ ] **Step 5: Run tests and checks**

Run: `npm test && npm run check`

Expected: all tests pass.

### Task 4: Touch pan and pinch zoom

**Files:**
- Modify: `src/main.js`
- Test: `test/camera-model.test.js`

**Interfaces:**
- Consumes `panCamera`, `zoomCameraAt`, `computePinchCamera`, and pointer-based persistent camera actions.
- Produces no additional public interface beyond `computePinchCamera` defined in Task 1.

- [ ] **Step 1: Add a failing `computePinchCamera` midpoint-stability test**

```js
test("pinch zoom preserves the logical midpoint and follows midpoint translation", () => {
  assert.deepEqual(
    computePinchCamera(
      { x: 100, y: 100, zoom: 1 },
      [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      [{ x: 80, y: 140 }, { x: 320, y: 140 }],
    ),
    { x: 133.33333333333331, y: 83.33333333333333, zoom: 1.2 },
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/camera-model.test.js`

Expected: FAIL because `computePinchCamera` has not been implemented.

- [ ] **Step 3: Implement pointer-map pinch handling**

Track active touch pointers by `pointerId`. One touch on canvas pans. Two touches capture starting distance, midpoint, zoom, and camera; moves apply zoom around the midpoint plus midpoint translation. Remove the old vertical swipe-to-navigate handlers.

- [ ] **Step 4: Run tests and checks**

Run: `npm test && npm run check`

Expected: all tests pass.

### Task 5: Replace AI-styled page chrome

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/main.js`

**Interfaces:**
- Keeps existing element IDs needed by JavaScript, except removing `activeScaleSlider` and `activeScaleValue`.
- Adds `previousStepButton`, `nextStepButton`, and `fitViewButton` IDs.

- [ ] **Step 1: Replace the page shell with the approved compact layout**

Use a plain title at top-left and a bottom-centered toolbar containing previous/next buttons, progress slider/counter, next-unit text, fit button, and zoom slider/value. Use inline SVG icons with accessible labels; remove the `NEXT` and `ZOOM` letter grids.

- [ ] **Step 2: Replace the visual token system**

```css
:root {
  --canvas: #1e1e1e;
  --canvas-dot: #363636;
  --toolbar: #262626;
  --toolbar-border: #3c3c3c;
  --text-on-dark: #f2f2ef;
  --muted-on-dark: #a3a39d;
  --paper: #fcfcfa;
  --ink: #171717;
  --accent: #6f92ff;
}
```

Use a 24px low-contrast radial dot grid on the canvas. Remove all blurred pseudo-elements, background orbit keyframes, glass/backdrop filters, orange/green states, pill decoration, and broad shadows.

- [ ] **Step 3: Make nodes feel like paper objects**

Use a 1px neutral border, 5px radius, restrained shadow, and no active fill. Active state uses a 2px cobalt outline and at most `1.06` scale. Reduce node movement to about 360ms, content state transitions to about 240ms, and link drawing to about 420ms. Disable map-layer transitions while panning or wheel-zooming.

- [ ] **Step 4: Add responsive and reduced-motion rules**

Keep the toolbar usable at 320px by wrapping into two compact rows. Preserve visible focus rings and remove nonessential motion under `prefers-reduced-motion`.

- [ ] **Step 5: Run syntax and regression tests**

Run: `npm test && npm run check`

Expected: all tests pass.

### Task 6: Documentation, browser QA, and release

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `skills/mindmap-ppt-builder/references/project-format.md` only if canvas behavior affects authoring guidance.

**Interfaces:**
- No new code interfaces.

- [ ] **Step 1: Update interaction documentation**

Document drag, wheel pan, pointer-centered zoom, fit view, keyboard navigation, bounded canvas behavior, and the removal of wheel-to-advance.

- [ ] **Step 2: Run full automated verification**

Run: `npm test && npm run check && git diff --check`

Expected: zero failures and no whitespace errors.

- [ ] **Step 3: Run desktop Playwright QA at 1440×900**

Verify fit view contains every node with at least 48px margin, drag changes the transform without changing progress, wheel pans, Ctrl/Cmd+wheel zooms around the pointer, next advances one unit, and image preview still opens/closes.

- [ ] **Step 4: Run mobile Playwright QA at 390×844**

Verify toolbar layout, one-pointer pan, two-pointer-compatible pointer handling through browser emulation where supported, fit view, logical-unit navigation, and image preview.

- [ ] **Step 5: Critique screenshots against the brief**

Confirm there are no glass panels, gradient blobs, letter grids, orange/green state colors, decorative eyebrow labels, or excessive rounded cards. Confirm the Stitch reference is limited to canvas depth and dot-grid behavior.

- [ ] **Step 6: Commit and push**

```bash
git add index.html src/main.js src/styles.css src/camera-model.js src/interaction.js test package.json README.md AGENTS.md docs/superpowers
git commit -m "feat: add bounded free canvas"
git push origin main
```
