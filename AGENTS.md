# AGENTS.md

## Project Overview

This is a small static front-end demo for a PPT-like animated mind map.

- Project data lives in `project/source.js`, which exports the unordered-list Markdown tree consumed by `src/main.js`.
- The tree is traversed in preorder.
- Nodes are rendered as HTML elements so their boxes can grow to contain text.
- Links are rendered as SVG curves behind the HTML nodes.
- The UI is plain HTML/CSS/JS, with no build step or runtime dependencies.

## Markdown Data Rules

- Each tree node is one unordered-list Markdown item.
- A list item may use an indented continuation line for a two-line label:

```md
- Markdown Mindmap
  项目汇报思维导图演示
    - 需求分析
      用户目标与演示场景
```

- For two-line labels, the first line is the subtitle and the second line is the main title.
- The top-left deck heading uses the root node the same way:
  - root first line -> eyebrow/subtitle
  - root second line -> main title
- Node boxes also use the same two-line convention:
  - first line -> small subtitle
  - second line -> normal-size title
- Single-line labels render as a normal one-line node title.
- Control readouts may collapse multiline labels into an inline preview such as `副标题 / 主标题`.
- A node may optionally attach one illustration with an `@image` metadata continuation line. Use paths relative to `project/`:

```md
- 展示设计
  画布布局与动画策略
  @image layout.svg
```

- `@image` lines are metadata only:
  - They do not appear in node text.
  - A node may have at most one image.
  - Supported image formats are whatever browser `<img>` supports; use PNG, JPG/JPEG, or SVG for project assets.
  - Prefer short local paths such as `example.svg`, `example.png`, or `image-asset-1/a.jpg`; they resolve to `./project/...`.
  - For example, `@image image-asset-1/a.jpg` resolves to `./project/image-asset-1/a.jpg`.
  - Explicit relative paths such as `./project/image-asset-1/a.jpg`, absolute paths, data URLs, and HTTP(S) URLs remain supported when needed.
  - If multiple `@image` lines are added to one node, the latest parsed value wins.
- `@unit` marks the start of one presentation logic unit and is metadata only:
  - A step starts at an `@unit` node and reveals that node plus every following preorder node up to the next `@unit`.
  - Mark the root and each major talk section with `@unit` for normal Agent-generated decks.
  - Keep evidence, examples, and supporting details inside their parent's unit unless they need their own speaking beat.
  - If a deck contains no `@unit`, navigation falls back to the legacy one-node-per-step behavior.
- Illustrations render inside their node card:
  - selected image nodes show the image expanded below the node text
  - non-selected image nodes show a small thumbnail below the node text
  - nodes without `@image` do not reserve image space
- Image expansion follows the real selected preorder node only. Clicking a node to move the camera must not expand its image unless it also changes `activeIndex`.

## Running And Checking

- Start local dev server: `npm run dev`
- Syntax check: `npm run check`
- Dev URL: `http://127.0.0.1:5173/`

The dev server is a dependency-free Node.js static server. If `5173` is occupied by a stale process, restart that process before validating in the browser.

## Core Files

- `index.html`: page shell and top controls.
- `project/source.js`: project Markdown data. Replace this file to change the mind map content.
- `project/`: project Markdown data and local assets referenced by `@image`.
- `src/main.js`: imports project data, parses Markdown, handles preorder navigation, layout model, HTML node sync, SVG link sync.
- `src/styles.css`: page styling, node/link styling, slider styling, animations.
- `p.md`: original product prompt/spec.

## Interaction Rules

- Arrow keys, Page Up/Page Down, Space, and Shift+Space move between logic units. Legacy decks without `@unit` still move one preorder node at a time.
- Bottom arrow buttons do the same.
- The range slider jumps directly to a presentation unit.
- Wheel and trackpad input pan the canvas; Ctrl/Command + wheel zooms around the pointer.
- Dragging empty canvas pans it. Touch supports one-finger pan and two-finger pan/zoom.
- The zoom slider uses a dynamic minimum derived from fit view and a fixed `200%` maximum. “适应画布” fits all currently revealed content with padding.
- Camera state persists across presentation steps. Changing the selected unit must not reset a valid user camera; nudge only when the new active node is fully outside the viewport.
- Clicking a visible node never changes the selected node or expanded image. If it is already visible, keep the camera unchanged; otherwise shift only enough to reveal it.
- Wheel and swipe gestures must never advance presentation steps. Presentation rhythm and canvas navigation are separate interaction layers.

Keep all navigation paths going through `setActiveStepIndex()` so buttons, keyboard, slider, graph, and counter stay synchronized.

## Layout Rules

- The current path from `root` to selected node is horizontal.
- Already visited but non-path branches appear above their parent and preserve tree structure.
- Unvisited nodes are completely hidden and occupy no layout space.
- The horizontal selected path should stay visually stable.
- Default node and text sizing is intentionally large, roughly 30% larger than the original compact demo.
- The camera pans and zooms across a fixed logical canvas. Slider, Ctrl/Command + wheel, and pinch are equivalent zoom inputs.
- The visible viewport uses the actual `#mindmap` element size. The presentation stage should stretch with the browser window.
- `layout.centerBaseline = 520` controls the horizontal path's baseline in logical canvas coordinates.
- Completed branches may exceed the viewport. Users can pan, zoom out, or use fit view to inspect them.
- Soft pan bounds must always leave at least a small strip of content visible so the graph cannot be lost completely.
- Image nodes participate in normal layout. The node box must grow to contain the thumbnail or expanded image.
- Expanded images may increase node height; camera logic should still use the central 40% band rule for the selected node.
- SVG links should connect from node border to node border, using the full node box dimensions.
- Node images should use `object-fit: contain` so oversized images shrink to the configured thumbnail/expanded bounds without cropping.
- Image expand/collapse should be animated smoothly when selection changes. Preserve CSS transitions for the image container size and image transform.
- Do not rebuild the node image DOM on every render; reuse stable `img` elements and toggle classes so browser transitions can interpolate thumbnail-to-expanded size changes.

## Animation Rules

- Node content is HTML and is wrapped as:

```html
<div class="mind-node">
  <div class="node-content">
    <span class="node-subtitle"></span>
    <span class="node-title"></span>
  </div>
</div>
```

- New nodes use a simple transition-based pop:
  - entering state: `scale(0.58)`, `opacity: 0`
  - active selected state: `scale(1.15)`, `opacity: 1`
  - normal unselected state: `scale(1)`
- Node movement, resizing, selection, and deselection should feel presentation-like and relatively slow:
  - node box movement/size transitions are roughly `820ms`-`860ms`
  - node content transform transitions are roughly `920ms`
  - image thumbnail/expanded transitions are roughly `920ms`
- Do not reintroduce keyframe-based transform fill for node pop. It previously prevented selected nodes from animating back down to normal size.
- Selected nodes keep a stable orange glow via box-shadow; do not use a spreading ring effect unless explicitly requested.
- Link reveal animation is still keyframe-based and should be preserved:
  - `pathLength="1"` in JS
  - `link-draw` in CSS

## Important Edge Cases

- Rapid navigation with the slider can expose delayed-removal races. If editing `syncNodes()` or `syncLinks()`, be careful with timeout-based removals:
  - Clear pending removal timers when an item becomes visible again, or
  - Check that the item is still not live inside the timeout before removing it.
- For a one-node tree, slider progress must not divide by zero. Guard `preorder.length - 1` if making the demo data configurable.

## Style Notes

- Treat the page as a quiet creative workspace, not an AI dashboard.
- Canvas palette: deep gray `#1e1e1e`, low-contrast dots `#363636`, solid toolbar `#262626`, divider `#3c3c3c`.
- Content palette: paper nodes `#fcfcfa`, ink `#171717`, muted text `#a3a39d`, active outline `#6f92ff`.
- Keep title treatment plain and typographic. Controls belong in one compact solid bottom toolbar.
- Nodes use subtle borders/shadows and small radii. Active state is a cobalt outline, never a dark fill, orange glow, or exaggerated scale.
- Do not add glass panels, gradient blobs, floating color orbits, letter-grid icons, decorative eyebrow labels, or multiple status colors.

## Development Notes

- Prefer editing with `apply_patch`.
- Keep the app dependency-free unless there is a clear reason to add tooling.
- Browser cache can retain old `src/main.js` because it is loaded as a module. If a normal refresh looks stale, use a hard refresh.
- This fork is the source of truth for the locally installed `mindmap-ppt-builder` skill.
- After changing anything under `skills/mindmap-ppt-builder/`, validate the skill, commit and push the repository, then replace `~/.codex/skills/mindmap-ppt-builder` with the repository version in the same task.
- Do not retain backups of older installed skill versions unless the user explicitly asks for one.
