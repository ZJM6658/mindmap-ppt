# Project Format Reference

## Repository

Target repo: `https://github.com/ZJM6658/mindmap-ppt`

Core files:

- `project/source.js`: project content and image references.
- `project/`: project content and local illustration assets.
- `src/main.js`: parser, navigation, layout, camera, node/image rendering.
- `src/styles.css`: visual style and animations.
- `AGENTS.md`: source-of-truth project rules.

## `project/source.js`

Use this shape:

```js
export const sourceMarkdown = `
- Markdown Mindmap
  项目汇报思维导图演示
  @unit
  @image overview.png
    - 需求分析
      用户目标与演示场景
      @unit
`;
```

Parsing rules:

- Lines matching `- text` create nodes.
- Indented continuation lines add to the current node label.
- `@image path` attaches one image to the current node and is not visible text.
- `@unit` marks the current node as the start of a presentation logic unit and is not visible text.
- Short image paths such as `overview.png` resolve to `./project/overview.png`.
- Nested short paths such as `image-asset-1/a.jpg` resolve to `./project/image-asset-1/a.jpg`.
- Explicit paths beginning with `./`, `../`, `/`, `http:`, `https:`, or `data:` are used as-is.
- Multiple `@image` lines on one node: last one wins.
- The tree is traversed preorder.

## Logic Unit Behavior

- A logic unit begins at an `@unit` node and includes every following preorder node up to the next `@unit`.
- One next/previous action moves between logic units and reveals the whole target unit at once.
- Mark the root as the opening unit, then mark each major section that deserves a separate speaking beat.
- Supporting evidence, examples, and details normally stay unmarked inside their parent's unit.
- If no node has `@unit`, the player preserves legacy node-by-node navigation.
- Images work inside units without extra syntax. Prefer the unit's primary illustration on its root; additional node images render as thumbnails and remain clickable.

## Node Text

Two-line node convention:

- first line: subtitle/category, smaller text
- second line: main title, normal title text

Single-line nodes render as title only.

Control readouts collapse multiline labels into `subtitle / title`.

## Image Behavior

Images render inside node cards:

- selected image node: expanded image below text
- non-selected image node: thumbnail below text
- no image: no image space

Supported formats: PNG, JPG/JPEG, SVG via browser `<img>`.

Use `object-fit: contain`; avoid crop-dependent compositions.

## Current Visual Style

Match the existing presentation style:

- background: deep gray workspace `#1e1e1e` with low-contrast dots `#363636`
- nodes: off-white paper `#fcfcfa` with dark ink `#171717`
- selected node: cobalt outline `#6f92ff`, without fill or scale emphasis
- controls: one compact solid toolbar `#262626`
- restrained borders and shadows
- small `8px` radii
- no glass panels, gradient blobs, floating color orbits, letter-grid icons, dense textures, or ornamental AI-dashboard decoration

## Camera And Layout Constraints

- Current path is horizontal.
- Already visited non-path branches appear above their parent.
- Unvisited nodes are hidden.
- Node sizes are real HTML/CSS sizes; do not rely on SVG text measurement.
- Links are SVG curves from node border to node border.
- Camera uses the actual viewport and persists across presentation steps.
- Empty-canvas drag, wheel/trackpad, Ctrl/Command + wheel, pinch, the zoom slider, and fit view are all supported.
- Author the tree for speaking logic, not viewport packing. Do not split a coherent unit merely to make it fit on screen.
