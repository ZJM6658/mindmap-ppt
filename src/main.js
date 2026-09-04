import { sourceMarkdown } from "../project/source.js";
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
} from "./camera-model.js";
import {
  getStepDeltaForKey,
  handleImageButtonKeydown,
  isCanvasInteractionTarget,
} from "./interaction.js";
import {
  assignTreeMetadata,
  buildPresentationSteps,
  collectPreorder,
  getPresentationState,
  parseMarkdownTree,
} from "./presentation-model.js";

const mindmap = document.querySelector("#mindmap");
const mapLayer = document.querySelector("#mapLayer");
const linkLayer = document.querySelector("#linkLayer");
const nodeLayer = document.querySelector("#nodeLayer");
const deckSubtitle = document.querySelector("#deckSubtitle");
const deckTitle = document.querySelector("#deckTitle");
const counter = document.querySelector("#counter");
const controls = document.querySelector(".controls");
const controlsBody = document.querySelector("#controlsBody");
const controlsToggle = document.querySelector("#controlsToggle");
const nodeSlider = document.querySelector("#nodeSlider");
const zoomSlider = document.querySelector("#zoomSlider");
const zoomValue = document.querySelector("#zoomValue");
const fitViewButton = document.querySelector("#fitViewButton");
const previousStepButton = document.querySelector("#previousStepButton");
const nextStepButton = document.querySelector("#nextStepButton");
const nextNodePreview = document.querySelector("#nextNodePreview");
const nextNodeSubtitle = document.querySelector("#nextNodeSubtitle");
const nextNodeTitle = document.querySelector("#nextNodeTitle");
const imageViewer = createImageViewer();

const SVG_NS = "http://www.w3.org/2000/svg";
const layout = {
  minNodeWidth: 146,
  minNodeHeight: 57,
  pathGap: 99,
  rowGap: 75,
  stagePaddingX: 114,
  stagePaddingY: 72,
  centerBaseline: 520,
};
const VIEW_PADDING = 48;
const MIN_VISIBLE_CONTENT = 72;
const MAX_ZOOM = 2;

let activeStepIndex = 0;
let root = parseMarkdownTree(sourceMarkdown);
let preorder = [];
let presentationSteps = [];
let idToNode = new Map();
let renderedNodes = new Map();
let renderedLinks = new Map();
let currentNodeMetrics = new Map();
let currentModel = null;
let currentBounds = null;
let camera = null;
let fitZoom = 1;
let pointerGesture = null;
const activePointers = new Map();

assignTreeMetadata(root);
preorder = collectPreorder(root);
presentationSteps = buildPresentationSteps(preorder);
idToNode = new Map(preorder.map((node) => [node.id, node]));
nodeSlider.max = String(presentationSteps.length);
updateDeckHeading(root.label);

controlsToggle.addEventListener("click", () => {
  const isCollapsed = controls.classList.toggle("collapsed");
  controlsBody.inert = isCollapsed;
  controlsBody.setAttribute("aria-hidden", String(isCollapsed));
  controlsToggle.setAttribute("aria-expanded", String(!isCollapsed));
  controlsToggle.setAttribute("aria-label", isCollapsed ? "展开控制面板" : "收起控制面板");
  controlsToggle.title = isCollapsed ? "展开控制面板" : "收起控制面板";
  controlsToggle.querySelector("span").textContent = isCollapsed ? "+" : "×";
});
nodeSlider.addEventListener("input", (event) => {
  setActiveStepIndex(Number(event.target.value));
});
zoomSlider.addEventListener("input", (event) => {
  setCameraZoom(Number(event.target.value) / 100, viewportCenter());
});
fitViewButton.addEventListener("click", fitView);
previousStepButton.addEventListener("click", () => setActiveStepIndex(activeStepIndex - 1));
nextStepButton.addEventListener("click", () => setActiveStepIndex(activeStepIndex + 1));
window.addEventListener("keydown", handleKeydown);
mindmap.addEventListener("wheel", handleWheel, { passive: false });
mindmap.addEventListener("pointerdown", handlePointerDown);
mindmap.addEventListener("pointermove", handlePointerMove);
mindmap.addEventListener("pointerup", handlePointerEnd);
mindmap.addEventListener("pointercancel", handlePointerEnd);
window.addEventListener("resize", handleResize);

render();

function handleKeydown(event) {
  if (imageViewer.isOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      imageViewer.close();
    }

    return;
  }

  const step = getStepDeltaForKey(event);
  if (step) {
    event.preventDefault();
    setActiveStepIndex(activeStepIndex + step);
  }
}

function handleWheel(event) {
  if (imageViewer.isOpen() || !camera) return;
  event.preventDefault();
  const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, getViewportSize().width);
  const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, getViewportSize().height);

  if (event.ctrlKey || event.metaKey) {
    const anchor = pointerInCanvas(event.clientX, event.clientY);
    const factor = Math.exp(-deltaY * 0.002);
    setCameraZoom(camera.zoom * factor, anchor, true);
    return;
  }

  const horizontalDelta = event.shiftKey && deltaX === 0 ? deltaY : deltaX;
  const verticalDelta = event.shiftKey && deltaX === 0 ? 0 : deltaY;
  camera = panCamera(camera, { x: -horizontalDelta, y: -verticalDelta });
  camera = clampCurrentCamera(camera);
  applyCameraTransform(true);
}

function normalizeWheelDelta(delta, deltaMode, pageSize) {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}

function handlePointerDown(event) {
  if (imageViewer.isOpen() || event.button !== 0 || !isCanvasInteractionTarget(event.target)) return;

  mindmap.setPointerCapture(event.pointerId);
  activePointers.set(event.pointerId, pointerInCanvas(event.clientX, event.clientY));
  pointerGesture = createPointerGesture();
  mindmap.classList.add("is-panning");
}

function handlePointerMove(event) {
  if (!activePointers.has(event.pointerId) || !camera) return;

  const previous = activePointers.get(event.pointerId);
  const current = pointerInCanvas(event.clientX, event.clientY);
  activePointers.set(event.pointerId, current);

  if (activePointers.size >= 2 && pointerGesture?.type === "pinch") {
    const next = computePinchCamera(
      pointerGesture.camera,
      pointerGesture.touches,
      [...activePointers.values()].slice(0, 2),
    );
    const zoom = clamp(next.zoom, computeMinZoom(fitZoom), MAX_ZOOM);
    camera = zoom === next.zoom ? next : zoomCameraAt(next, zoom, midpoint([...activePointers.values()].slice(0, 2)));
  } else if (activePointers.size === 1 && previous) {
    camera = panCamera(camera, { x: current.x - previous.x, y: current.y - previous.y });
  }

  camera = clampCurrentCamera(camera);
  applyCameraTransform(true);
}

function handlePointerEnd(event) {
  if (!activePointers.has(event.pointerId)) return;

  activePointers.delete(event.pointerId);
  if (activePointers.size === 0) {
    pointerGesture = null;
    mindmap.classList.remove("is-panning");
    return;
  }

  pointerGesture = createPointerGesture();
}

function createPointerGesture() {
  const touches = [...activePointers.values()];
  return {
    type: touches.length >= 2 ? "pinch" : "pan",
    camera: { ...camera },
    touches: touches.slice(0, 2),
  };
}

function midpoint(points) {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setActiveStepIndex(index) {
  activeStepIndex = Math.max(0, Math.min(index, presentationSteps.length));
  render();
}

function render() {
  const presentationState = getPresentationState(presentationSteps, activeStepIndex, preorder);
  const { activeNode, visibleEndIndex } = presentationState;
  currentNodeMetrics = measureAllNodes(preorder, activeNode);
  const model = activeNode ? buildVisibleModel(activeNode, visibleEndIndex) : buildEndModel();
  currentModel = model;
  currentBounds = computeBounds(model.nodes);
  const viewport = getViewportSize();
  const fittedCamera = computeFitCamera(currentBounds, viewport, VIEW_PADDING);
  fitZoom = fittedCamera.zoom;
  if (camera) {
    const boundedZoom = clamp(camera.zoom, computeMinZoom(fitZoom), MAX_ZOOM);
    const zoomAdjustedCamera =
      boundedZoom === camera.zoom ? camera : zoomCameraAt(camera, boundedZoom, viewportCenter());
    camera = reconcileCamera(
      zoomAdjustedCamera,
      currentBounds,
      getNodeRect(model.nodes.find((node) => node.isActive)),
      viewport,
      VIEW_PADDING,
      MIN_VISIBLE_CONTENT,
    );
  } else {
    camera = fittedCamera;
  }

  syncLinks(model.links);
  syncNodes(model.nodes, activeNode);
  updateCanvasSize(model);
  applyCameraTransform();
  updateControls();
}

function measureAllNodes(nodes, activeNode) {
  const measurer = document.createElement("div");
  measurer.className = "node-measurer";
  document.body.appendChild(measurer);

  const metrics = new Map();
  nodes.forEach((node) => {
    const content = createNodeContent();
    updateNodeContent(content, node, node.id === activeNode?.id);
    measurer.appendChild(content.root);

    const rect = content.root.getBoundingClientRect();
    metrics.set(node.id, {
      width: Math.max(layout.minNodeWidth, Math.ceil(rect.width)),
      height: Math.max(layout.minNodeHeight, Math.ceil(rect.height)),
    });

    content.root.remove();
  });

  measurer.remove();
  return metrics;
}

function buildEndModel() {
  const visibleIds = new Set(preorder.map((node) => node.id));
  const positions = new Map();
  const nodes = [];
  const links = [];
  const rootMetric = getNodeMetric(root);

  placeSubtree(root, visibleIds, positions, {
    x: layout.stagePaddingX + rootMetric.width / 2,
    y: layout.centerBaseline,
  });

  visibleIds.forEach((id) => {
    const node = idToNode.get(id);
    const position = positions.get(id);
    if (!position) {
      return;
    }

    nodes.push({
      id,
      label: node.label,
      x: position.x,
      y: position.y,
      width: getNodeMetric(node).width,
      height: getNodeMetric(node).height,
      depth: node.depth,
      preorderIndex: node.preorderIndex,
      isPath: false,
      isActive: false,
      isComplete: false,
    });

    if (node.parent && positions.has(node.parent.id)) {
      const parentMetric = getNodeMetric(node.parent);
      const nodeMetric = getNodeMetric(node);
      links.push({
        id: `${node.parent.id}->${node.id}`,
        from: positions.get(node.parent.id),
        fromWidth: parentMetric.width,
        to: position,
        toWidth: nodeMetric.width,
        isPathLink: false,
      });
    }
  });

  return { nodes, links, baseline: layout.centerBaseline, isEnd: true };
}

function buildVisibleModel(activeNode, visibleEndIndex) {
  const path = pathToRoot(activeNode);
  const pathIds = new Set(path.map((node) => node.id));
  const visibleIds = new Set(preorder.slice(0, visibleEndIndex + 1).map((node) => node.id));
  const positions = new Map();
  const nodes = [];
  const links = [];
  const completedSubtrees = [];

  path.forEach((node, depthIndex) => {
    const completeChildren = node.children.filter(
      (child) => visibleIds.has(child.id) && !pathIds.has(child.id),
    );

    completeChildren.forEach((child) => {
      completedSubtrees.push({
        child,
        depthIndex,
        height: measureSubtree(child, visibleIds).height,
      });
    });
  });

  const completedHeight =
    completedSubtrees.reduce((total, subtree) => total + subtree.height, 0) +
    Math.max(0, completedSubtrees.length - 1) * layout.rowGap;
  const baseline = layout.centerBaseline;
  let pathCursorX = layout.stagePaddingX;

  path.forEach((node, index) => {
    const metric = getNodeMetric(node);
    positions.set(node.id, {
      x: pathCursorX + metric.width / 2,
      y: baseline,
    });
    pathCursorX += metric.width + layout.pathGap;
  });

  let cursorY = baseline - layout.rowGap - completedHeight;
  completedSubtrees.forEach((subtree) => {
    const parentPosition = positions.get(path[subtree.depthIndex].id);
    const parentMetric = getNodeMetric(path[subtree.depthIndex]);
    const childMetric = getNodeMetric(subtree.child);
    placeSubtree(subtree.child, visibleIds, positions, {
      x: parentPosition.x + parentMetric.width / 2 + layout.pathGap + childMetric.width / 2,
      y: cursorY + subtree.height / 2,
    });
    cursorY += subtree.height + layout.rowGap;
  });

  visibleIds.forEach((id) => {
    const node = idToNode.get(id);
    const position = positions.get(id);
    if (!position) {
      return;
    }

    const isPath = pathIds.has(id);
    nodes.push({
      id,
      label: node.label,
      x: position.x,
      y: position.y,
      width: getNodeMetric(node).width,
      height: getNodeMetric(node).height,
      depth: node.depth,
      preorderIndex: node.preorderIndex,
      isPath,
      isActive: node.id === activeNode.id,
      isComplete: !isPath,
    });

    if (node.parent && positions.has(node.parent.id)) {
      const parentMetric = getNodeMetric(node.parent);
      const nodeMetric = getNodeMetric(node);
      links.push({
        id: `${node.parent.id}->${node.id}`,
        from: positions.get(node.parent.id),
        fromWidth: parentMetric.width,
        to: position,
        toWidth: nodeMetric.width,
        isPathLink: pathIds.has(node.parent.id) && pathIds.has(node.id),
      });
    }
  });

  return { nodes, links, baseline };
}

function pathToRoot(node) {
  const path = [];
  let current = node;

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
}

function measureSubtree(node, visibleIds) {
  const visibleChildren = node.children.filter((child) => visibleIds.has(child.id));
  const metric = getNodeMetric(node);
  if (visibleChildren.length === 0) {
    return { height: metric.height };
  }

  const childHeights = visibleChildren.map((child) => measureSubtree(child, visibleIds).height);
  return {
    height: Math.max(
      metric.height,
      childHeights.reduce((total, height) => total + height, 0) + (childHeights.length - 1) * layout.rowGap,
    ),
  };
}

function placeSubtree(node, visibleIds, positions, anchor) {
  const visibleChildren = node.children.filter((child) => visibleIds.has(child.id));
  positions.set(node.id, { x: anchor.x, y: anchor.y });

  if (visibleChildren.length === 0) {
    return;
  }

  const childMeasures = visibleChildren.map((child) => ({
    child,
    height: measureSubtree(child, visibleIds).height,
  }));
  const totalHeight =
    childMeasures.reduce((total, item) => total + item.height, 0) + (childMeasures.length - 1) * layout.rowGap;

  let childCursor = anchor.y - totalHeight / 2;
  childMeasures.forEach(({ child, height }) => {
    const childY = childCursor + height / 2;
    const nodeMetric = getNodeMetric(node);
    const childMetric = getNodeMetric(child);
    placeSubtree(child, visibleIds, positions, {
      x: anchor.x + nodeMetric.width / 2 + layout.pathGap + childMetric.width / 2,
      y: childY,
    });
    childCursor += height + layout.rowGap;
  });
}

function getNodeMetric(node) {
  return currentNodeMetrics.get(node.id) ?? {
    width: layout.minNodeWidth,
    height: layout.minNodeHeight,
  };
}

function updateCanvasSize(model) {
  const width = Math.max(1, currentBounds.maxX + layout.stagePaddingX);
  const height = Math.max(1, currentBounds.maxY + layout.stagePaddingY);

  mapLayer.style.width = `${width}px`;
  mapLayer.style.height = `${height}px`;
  linkLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
}

function applyCameraTransform(isDirectManipulation = false) {
  if (!camera) return;

  mindmap.classList.toggle("is-direct-manipulation", isDirectManipulation);
  mapLayer.style.transform = `scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`;
  updateZoomControls();
  if (isDirectManipulation) {
    window.clearTimeout(applyCameraTransform.releaseTimer);
    applyCameraTransform.releaseTimer = window.setTimeout(() => {
      mindmap.classList.remove("is-direct-manipulation");
    }, 120);
  }
}

function setCameraZoom(nextZoom, anchor = viewportCenter(), direct = false) {
  if (!camera) return;

  const zoom = clamp(nextZoom, computeMinZoom(fitZoom), MAX_ZOOM);
  camera = zoomCameraAt(camera, zoom, anchor);
  camera = clampCurrentCamera(camera);
  applyCameraTransform(direct);
}

function fitView() {
  if (!currentBounds) return;
  camera = computeFitCamera(currentBounds, getViewportSize(), VIEW_PADDING);
  fitZoom = camera.zoom;
  applyCameraTransform();
}

function handleResize() {
  if (!camera || !currentBounds) return;
  fitZoom = computeFitCamera(currentBounds, getViewportSize(), VIEW_PADDING).zoom;
  const boundedZoom = clamp(camera.zoom, computeMinZoom(fitZoom), MAX_ZOOM);
  camera = boundedZoom === camera.zoom ? camera : zoomCameraAt(camera, boundedZoom, viewportCenter());
  camera = clampCurrentCamera(camera);
  applyCameraTransform();
}

function clampCurrentCamera(nextCamera) {
  return clampCamera(nextCamera, currentBounds, getViewportSize(), MIN_VISIBLE_CONTENT);
}

function viewportCenter() {
  const viewport = getViewportSize();
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

function pointerInCanvas(clientX, clientY) {
  const rect = mindmap.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function getNodeRect(node) {
  if (!node) return null;
  return {
    minX: node.x - node.width / 2,
    maxX: node.x + node.width / 2,
    minY: node.y - node.height / 2,
    maxY: node.y + node.height / 2,
  };
}

function getViewportSize() {
  return {
    width: Math.max(1, mindmap.clientWidth),
    height: Math.max(1, mindmap.clientHeight),
  };
}

function syncNodes(nodes, activeNode) {
  const liveIds = new Set(nodes.map((node) => node.id));

  renderedNodes.forEach((entry, id) => {
    if (!liveIds.has(id)) {
      entry.group.classList.add("leaving");
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = window.setTimeout(() => {
        entry.group.remove();
        renderedNodes.delete(id);
      }, 220);
      return;
    }

    if (entry.removalTimer) {
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = null;
      entry.group.classList.remove("leaving");
    }
  });

  nodes
    .sort((a, b) => a.preorderIndex - b.preorderIndex)
    .forEach((node) => {
      let entry = renderedNodes.get(node.id);
      if (!entry) {
        entry = createNodeElement(node);
        renderedNodes.set(node.id, entry);
        nodeLayer.appendChild(entry.group);
      }

      entry.group.classList.toggle("active", node.isActive);
      entry.group.classList.toggle("path-node", node.isPath);
      entry.group.classList.toggle("complete-node", node.isComplete);
      entry.group.dataset.nodeId = node.id;
      if (activeNode && node.id === activeNode.id) {
        entry.group.setAttribute("aria-current", "true");
      } else {
        entry.group.removeAttribute("aria-current");
      }
      entry.group.setAttribute("aria-label", `查看 ${formatInlineLabel(node.label)} 的视角`);
      entry.group.style.width = `${node.width}px`;
      entry.group.style.height = `${node.height}px`;
      entry.group.style.transform = `translate(${node.x - node.width / 2}px, ${node.y - node.height / 2}px)`;
      updateNodeContent(entry.content, idToNode.get(node.id), node.isActive);
    });
}

function createNodeElement(node) {
  const group = document.createElement("div");
  group.classList.add("mind-node", "entering");
  group.setAttribute("role", "button");
  group.setAttribute("tabindex", "0");
  group.addEventListener("click", () => focusCameraOnNode(node.id));
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusCameraOnNode(node.id);
    }
  });

  const content = createNodeContent();
  const activeNode = presentationSteps[activeStepIndex]?.node;
  updateNodeContent(content, node, node.id === activeNode?.id);
  group.append(content.root);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => group.classList.remove("entering"));
  });

  return { group, content, removalTimer: null };
}

function focusCameraOnNode(nodeId) {
  const node = currentModel?.nodes.find((item) => item.id === nodeId);
  if (!node || !camera) return;

  camera = ensureRectVisible(camera, getNodeRect(node), getViewportSize(), VIEW_PADDING);
  camera = clampCurrentCamera(camera);
  applyCameraTransform();
}

function createNodeContent() {
  const content = document.createElement("div");
  content.classList.add("node-content");

  const subtitle = document.createElement("span");
  subtitle.classList.add("node-subtitle");

  const title = document.createElement("span");
  title.classList.add("node-title");

  const imageWrap = document.createElement("button");
  imageWrap.type = "button";
  imageWrap.classList.add("node-image");
  imageWrap.addEventListener("click", (event) => {
    event.stopPropagation();
    const src = imageWrap.dataset.previewSrc;
    if (src) {
      imageViewer.open(src, imageWrap.dataset.previewAlt || "节点插图");
    }
  });
  imageWrap.addEventListener("keydown", handleImageButtonKeydown);

  const image = document.createElement("img");
  imageWrap.appendChild(image);
  content.append(subtitle, title, imageWrap);

  return { root: content, subtitle, title, imageWrap, image };
}

function updateNodeContent(content, node, isActive) {
  const [subtitle, ...titleLines] = node.label.split("\n");
  const title = titleLines.length > 0 ? titleLines.join(" / ") : subtitle;

  content.root.classList.toggle("has-subtitle", titleLines.length > 0);
  content.root.classList.toggle("has-node-image", Boolean(node.image));
  content.root.classList.toggle("image-expanded", Boolean(node.image) && isActive);
  content.subtitle.textContent = subtitle;
  content.title.textContent = title;

  if (node.image) {
    if (content.image.getAttribute("src") !== node.image) {
      content.image.src = node.image;
    }

    content.image.alt = `${formatInlineLabel(node.label)} 插图`;
    content.imageWrap.disabled = false;
    content.imageWrap.dataset.previewSrc = node.image;
    content.imageWrap.dataset.previewAlt = content.image.alt;
    content.imageWrap.setAttribute("aria-label", `放大查看 ${content.image.alt}`);
  } else {
    content.image.removeAttribute("src");
    content.image.alt = "";
    content.imageWrap.disabled = true;
    delete content.imageWrap.dataset.previewSrc;
    delete content.imageWrap.dataset.previewAlt;
    content.imageWrap.removeAttribute("aria-label");
  }
}

function createImageViewer() {
  const overlay = document.createElement("div");
  overlay.classList.add("image-viewer");
  overlay.setAttribute("aria-hidden", "true");

  const frame = document.createElement("div");
  frame.classList.add("image-viewer-frame");
  frame.setAttribute("role", "dialog");
  frame.setAttribute("aria-modal", "true");
  frame.setAttribute("aria-label", "插图大图预览，点击任意位置关闭");

  const image = document.createElement("img");
  image.classList.add("image-viewer-img");
  let returnFocusTarget = null;

  frame.append(image);
  overlay.append(frame);
  document.body.append(overlay);

  function open(src, alt) {
    returnFocusTarget = document.activeElement;
    image.src = src;
    image.alt = alt;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("image-viewer-open");
  }

  function close() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("image-viewer-open");
    if (returnFocusTarget && document.contains(returnFocusTarget)) {
      returnFocusTarget.focus();
    }
    returnFocusTarget = null;
  }

  overlay.addEventListener("click", close);

  return {
    open,
    close,
    isOpen: () => overlay.classList.contains("open"),
  };
}

function syncLinks(links) {
  const liveIds = new Set(links.map((link) => link.id));

  renderedLinks.forEach((entry, id) => {
    if (!liveIds.has(id)) {
      entry.path.classList.add("leaving");
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = window.setTimeout(() => {
        entry.path.remove();
        renderedLinks.delete(id);
      }, 220);
      return;
    }

    if (entry.removalTimer) {
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = null;
      entry.path.classList.remove("leaving");
    }
  });

  links.forEach((link) => {
    let entry = renderedLinks.get(link.id);
    if (!entry) {
      const path = document.createElementNS(SVG_NS, "path");
      path.classList.add("mind-link", "entering");
      path.setAttribute("pathLength", "1");
      entry = { path, removalTimer: null };
      renderedLinks.set(link.id, entry);
      linkLayer.appendChild(path);
      window.setTimeout(() => path.classList.remove("entering"), 980);
    }

    entry.path.classList.toggle("path-link", link.isPathLink);
    entry.path.setAttribute("d", linkPath(link));
  });
}

function linkPath(link) {
  const startX = link.from.x + link.fromWidth / 2;
  const startY = link.from.y;
  const endX = link.to.x - link.toWidth / 2;
  const endY = link.to.y;
  const midX = startX + Math.max(36, (endX - startX) * 0.5);

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function updateControls() {
  const nextNode = presentationSteps[activeStepIndex + 1]?.node;
  const endIndex = presentationSteps.length;
  const isEnd = activeStepIndex === endIndex;
  const sliderProgress = endIndex === 0 ? 0 : (activeStepIndex / endIndex) * 100;
  const label = getNextStepLabel(nextNode, isEnd);

  counter.textContent = `${activeStepIndex + 1} / ${endIndex + 1}`;
  nodeSlider.value = String(activeStepIndex);
  nodeSlider.style.setProperty("--slider-progress", `${sliderProgress}%`);
  previousStepButton.disabled = activeStepIndex === 0;
  nextStepButton.disabled = isEnd;
  updateZoomControls();
  nextNodePreview.classList.toggle("has-subtitle", label.hasSubtitle);
  nextNodeSubtitle.textContent = label.subtitle;
  nextNodeTitle.textContent = label.title;
}

function updateZoomControls() {
  if (!camera) return;
  const minZoom = computeMinZoom(fitZoom);
  zoomSlider.min = String(Math.round(minZoom * 100));
  zoomSlider.max = String(MAX_ZOOM * 100);
  zoomSlider.value = String(Math.round(camera.zoom * 100));
  zoomValue.textContent = `${Math.round(camera.zoom * 100)}%`;
}

function getNextStepLabel(nextNode, isEnd) {
  if (isEnd) {
    return {
      hasSubtitle: true,
      subtitle: "当前",
      title: "结束总览",
    };
  }

  if (nextNode) {
    return splitLabel(nextNode.label);
  }

  return {
    hasSubtitle: true,
    subtitle: "下一步",
    title: "结束总览",
  };
}

function updateDeckHeading(label) {
  const heading = splitLabel(label);

  deckSubtitle.textContent = heading.subtitle;
  deckTitle.textContent = heading.title;
}

function formatInlineLabel(label) {
  return label.replace(/\s*\n\s*/g, " / ");
}

function splitLabel(label) {
  const [subtitle, ...titleLines] = label.split("\n");
  const hasSubtitle = titleLines.length > 0;

  return {
    hasSubtitle,
    subtitle,
    title: hasSubtitle ? titleLines.join("\n") : subtitle,
  };
}
