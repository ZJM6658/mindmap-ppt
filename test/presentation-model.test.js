import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPresentationSteps,
  collectPreorder,
  getPresentationState,
  parseMarkdownTree,
} from "../src/presentation-model.js";

test("parses @unit and @image as node metadata instead of visible label text", () => {
  const root = parseMarkdownTree(`
- 主题
  三分钟讲清产品
  @unit
  @image overview.png
    - 证据
      用户完成时间缩短
`);

  assert.equal(root.label, "主题\n三分钟讲清产品");
  assert.equal(root.isUnit, true);
  assert.equal(root.image, "./project/overview.png");
  assert.equal(root.children[0].label, "证据\n用户完成时间缩短");
});

test("groups preorder nodes from one @unit marker up to the next marker", () => {
  const root = parseMarkdownTree(`
- 主题
  @unit
    - 痛点
      @unit
        - 现状
        - 影响
    - 方案
      @unit
        - 一次推进
        - 支持图片
`);
  const preorder = collectPreorder(root);

  assert.deepEqual(
    buildPresentationSteps(preorder).map(({ startIndex, endIndex }) => [startIndex, endIndex]),
    [
      [0, 0],
      [1, 3],
      [4, 6],
    ],
  );
});

test("preserves node-by-node navigation when a deck has no @unit markers", () => {
  const root = parseMarkdownTree(`
- root
    - a
        - a0
`);
  const preorder = collectPreorder(root);

  assert.deepEqual(
    buildPresentationSteps(preorder).map(({ startIndex, endIndex }) => [startIndex, endIndex]),
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
  );
});

test("keeps nodes before the first explicit @unit as an implicit opening step", () => {
  const root = parseMarkdownTree(`
- root
    - opening detail
    - first unit
      @unit
        - evidence
`);
  const preorder = collectPreorder(root);

  assert.deepEqual(
    buildPresentationSteps(preorder).map(({ startIndex, endIndex }) => [startIndex, endIndex]),
    [
      [0, 1],
      [2, 3],
    ],
  );
});

test("selects the unit root while revealing every node in that unit", () => {
  const root = parseMarkdownTree(`
- root
  @unit
    - problem
      @unit
        - cause
        - impact
    - solution
      @unit
`);
  const preorder = collectPreorder(root);
  const steps = buildPresentationSteps(preorder);

  const state = getPresentationState(steps, 1, preorder);

  assert.equal(state.activeNode.label, "problem");
  assert.equal(state.visibleEndIndex, 3);
  assert.equal(state.isEnd, false);
});

test("returns the full-tree overview after the final logical unit", () => {
  const root = parseMarkdownTree(`
- root
  @unit
    - unit
      @unit
        - detail
`);
  const preorder = collectPreorder(root);
  const steps = buildPresentationSteps(preorder);

  assert.deepEqual(getPresentationState(steps, steps.length, preorder), {
    activeNode: null,
    visibleEndIndex: 2,
    isEnd: true,
  });
});
