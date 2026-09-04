---
name: mindmap-ppt-builder
description: Use when turning a prose draft, article, speech, report, or notes into project/source.js content and illustrations for the mindmap-ppt presentation project. Operates only within the current working directory.
---

# Mindmap PPT Builder

## Goal

Turn a user-provided source document into a presentation-ready `project/source.js` for this repo. The source document may be pasted text in the conversation or a local text/Markdown file path supplied by the user. The output is a preorder mind-map organized into speaking-sized logic units, with concise two-line nodes, optional images, and local assets that match the current light PPT style.

Read `references/project-format.md` when you need exact project file conventions or visual constraints.

## Workspace Requirement

This skill operates only within the current working directory tree (cwd itself or a `mindmap-ppt/` subfolder under it). Do not search parent, sibling, or home directories for an existing checkout.

- Clone `https://github.com/ZJM6658/mindmap-ppt` into `./mindmap-ppt/` under the current working directory and `cd` in.
- If `./mindmap-ppt/` already exists, stop and ask the user how to proceed. Do not `cd ..`, `find`, or otherwise probe the filesystem to locate or create a checkout elsewhere.
- Keep the application repository outside the skill folder. Do not copy or clone `index.html`, `src/`, or `project/` into `.agents/skills/mindmap-ppt-builder/`.
- Normal skill output should modify only `project/source.js` and local asset files under `project/`.
- Do not delete existing project assets unless the user explicitly asks for cleanup.
- Do not edit `src/`, `index.html`, or application behavior unless the user explicitly asks for implementation changes.

## Workflow

1. Get the user's source document:
   - Use pasted text from the conversation when provided.
   - If the user gives a local file path, read only that explicitly provided document file and use its contents.
   - If neither pasted text nor a readable local file is available, ask the user for the document before generating `project/source.js`.
2. Read the document and identify the presentation thesis.
   - Follow the source language by default: Chinese input -> Chinese output; English input -> English output.
   - For English output, still use an eyebrow/headline structure for two-line nodes when natural.
   - Do not silently correct facts. If the source has obvious contradictions or questionable claims, preserve the claim carefully or mention the conflict to the user.
   - For very long documents, preserve the original chapter structure first. If the material is too broad to reduce confidently, draft a high-level outline and ask the user to confirm priorities before finalizing.
3. Build a clear logic tree:
   - root: document/source name or presentation topic
   - major branches: usually 2-4 sections, but follow the source logic when another structure is clearer
   - child nodes: use them for causes, consequences, evidence, examples, process steps, contrasts, or supplements
   - depth: add levels only when nesting makes the author's logic easier to understand
4. Divide the talk into logic units before writing nodes:
   - A logic unit is one coherent speaking beat that the presenter should reveal with a single “next” action.
   - Mark the root as the opening unit. Mark each major section that starts a new claim, phase, comparison, or conclusion as another unit.
   - Keep evidence, examples, explanations, and supporting details inside their parent's unit unless the presenter genuinely needs to pause and introduce them separately.
   - A typical unit contains a main node plus 2-6 supporting nodes and should carry roughly 30-120 seconds of speech. These are judgment guides, not hard quotas.
   - The number of units should be meaningfully smaller than the number of nodes. If nearly every node is marked, regroup before finalizing.
5. Write each node as one unordered-list item plus an optional continuation line:

```md
- 副标题
  主标题
```

Use the first line as a short category label and the second line as the main message. Keep each line under about 30 Chinese characters or 8 English words. Prefer two-line labels for all visible nodes; use a single-line node only when the label is already extremely short and clear.

6. Add `@unit` after the visible label of every logic-unit root:

```md
- 开场
  为什么现在需要改变
  @unit
    - 用户痛点
      重复操作打断表达
    - 业务影响
      演示节奏持续拖慢
```

The player reveals every preorder node from one `@unit` marker up to the next marker in a single step. Always emit `@unit` for newly generated decks; the marker-free mode exists only for compatibility with older content.

7. Choose image nodes sparingly:
   - Node images are optional.
   - A mind-map necessarily omits a lot of source detail; use images to preserve or explain the omitted detail on high-information nodes.
   - Prefer one primary image on the root of an image-worthy logic unit. Add internal node images only when they explain distinct evidence or a different visual model.
   - Pick 3-8 high-information nodes for a typical deck; short drafts may use 0-2 images.
   - Prefer nodes that summarize a process, architecture, comparison, timeline, metric, or conceptual model.
8. Generate illustrations for chosen nodes with GPT Image 2 or the available image generation tool. Save them under `project/` or a subfolder of `project/`.
   - Prefer PNG for generated raster illustrations, SVG for diagrams or placeholders, and JPG for photo-like assets.
   - If image generation is unavailable, either omit images or create simple SVG placeholder diagrams under `project/` using the same restrained palette. Use 16:10 composition, minimal short text only when useful, and descriptive kebab-case filenames such as `project/demo-flow.svg`.
9. Reference images in Markdown metadata lines:

```md
  @image process-overview.png
```

10. Replace `project/source.js` with:

```js
export const sourceMarkdown = `
- ...
`;
```

Escape backticks and `${...}` sequences before writing user-derived text inside the JavaScript template string.

11. Run `npm test` and `npm run check`.
12. Preview the deck when browser inspection is available. Confirm that one navigation action reveals one coherent unit, images render, and the talk no longer requires a separate action for every supporting node.

## Mindmap Authoring Rules

- Do not force every deck into a strict `root -> level 1 -> level 2 -> level 3` taxonomy. That shape is only a useful default, not a rule.
- Let the hierarchy express the author's logic structure. If cause A leads to result B, B can be a child node of A; if B further leads to result C, form an `A -> B -> C` subtree.
- The only hard principle is clarity: a reader should understand why each child node belongs under its parent and what relationship is being expressed.
- Follow the source order. This app reveals nodes in preorder: parent first, then all children. Do not move conclusions from later text into earlier parent labels.
- Treat tree structure and presentation rhythm as separate decisions. Nodes preserve the material's logic; `@unit` markers define when the presenter advances.
- A new unit begins at an `@unit` node and continues through all following preorder nodes until the next `@unit`. Place every boundary deliberately.
- Do not repeat the root topic in child nodes. If the root already states the problem or theme, children should advance the story.
- Group nearby meanings under one parent. Keep backgrounds, criteria, risks, product/tool inventories, recommendations, and conclusions in their own coherent branches.
- Main nodes carry judgments; child nodes carry evidence, reasons, examples, or supplements. If a node explains another node, make it a child, not a sibling.
- Keep each parent to at most 5 children. If there are more, add grouping nodes.
- Split tools/products only when the source analyzes them one by one. Merge them when the source merely lists options in passing.
- Do not split sentence by sentence. One node should carry one complete small point.
- Each node should correspond to about 10-80 Chinese characters of source material (this is the source span a node covers, not its visible label length). Less than 10 is usually too fragmented; more than 80 usually needs splitting.
- Node text may be slightly longer than a normal title, but one node should not contain multiple independent ideas.
- Parent labels should summarize and navigate; child labels should reveal specifics. Avoid parent labels that spoil later details.
- Put images on high-information nodes, such as framework, comparison, inventory, recommendation, or risk-model nodes. Avoid images on very small detail nodes.

## Markdown, Logic Unit, And Image Example

Use `@unit` and `@image` as metadata continuation lines after the node's visible two-line label. Neither line is displayed as node text.

```js
export const sourceMarkdown = `
- 产品发布
  三分钟讲清楚新功能
  @unit
  @image overview.png
    - 用户痛点
      当前流程成本很高
      @unit
      @image image-asset-1/pain-points.jpg
    - 解决方案
      自动整理文稿和插图
    - 演示效果
      像 PPT 一样逐步展开
      @image diagrams/demo-flow.svg
`;
```

This example has two presentation steps: the opening unit, then the user-pain unit containing the remaining solution and demo nodes. The active unit root image expands; other images inside the unit remain visible as clickable thumbnails.

Image paths are relative to `project/` by default:

- `@image overview.png` -> `./project/overview.png`
- `@image image-asset-1/pain-points.jpg` -> `./project/image-asset-1/pain-points.jpg`
- `@image diagrams/demo-flow.svg` -> `./project/diagrams/demo-flow.svg`

## Image Prompt Pattern

Use this style prompt for GPT Image 2:

```text
Create a clean presentation illustration for a light PPT mind-map node.
Subject: <node main idea>.
Include: <2-4 concrete visual elements from the source text>.
Style: restrained vector-like editorial illustration, warm off-white background, dark teal #183a4a, muted green #eef7f3, orange accent #d8894f, simple geometric shapes, thin shadows, small 8px-radius card-like forms, no photorealism, minimal short text only when useful, no logos, no busy decorations.
Composition: centered, generous whitespace, readable at thumbnail size, aspect ratio 16:10.
```

If the source needs a real chart, diagram, or screenshot, create a simple diagrammatic illustration instead of inventing precise numbers. Prefer no text in images; when text improves comprehension, use only 1-3 short labels or keywords and keep detailed labels in nodes.

## SVG Placeholder Pattern

When no image-generation tool is available but an illustration is still useful, a simple SVG placeholder is acceptable:

- Size: `1280x800`.
- Style: warm off-white background, dark teal `#183a4a`, muted green `#eef7f3`, orange accent `#d8894f`.
- Content: abstract process blocks, arrows, cards, or timeline shapes based on the node idea.
- Minimal short text only when useful; no logos, dense decoration, or photorealism.

## Image And Asset Rules

- Place `@unit` after a node's visible title and before its children.
- Use `@image` only after the node's title line, before its children.
- Use PNG, JPG/JPEG, or SVG assets.
- Save image files under `project/` or a subfolder of `project/`.
- Prefer short `@image` values relative to `project/`, e.g. `@image user-journey.png`, `@image diagrams/user-journey.png`, or `@image image-asset-1/a.jpg`.

## Validation Checklist

- `project/source.js` exports `sourceMarkdown`.
- The root and every intended speaking boundary have `@unit`.
- Units are materially fewer than nodes and each unit carries a coherent point.
- Asset files exist for every `@image`.
- `npm test` passes.
- `npm run check` passes.
