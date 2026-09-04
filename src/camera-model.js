const DEFAULT_BOUNDS = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
};

function clamp(value, min, max) {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function computeBounds(items = []) {
  if (!items.length) return { ...DEFAULT_BOUNDS };

  return items.reduce(
    (bounds, item) => {
      const halfWidth = (item.width ?? 0) / 2;
      const halfHeight = (item.height ?? 0) / 2;

      return {
        minX: Math.min(bounds.minX, item.x - halfWidth),
        maxX: Math.max(bounds.maxX, item.x + halfWidth),
        minY: Math.min(bounds.minY, item.y - halfHeight),
        maxY: Math.max(bounds.maxY, item.y + halfHeight),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

export function computeFitCamera(bounds, viewport, padding = 48) {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = round(Math.min(1, availableWidth / width, availableHeight / height));
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: centerX - viewport.width / (2 * zoom),
    y: centerY - viewport.height / (2 * zoom),
    zoom,
  };
}

export function computeMinZoom(fitZoom) {
  return round(clamp(fitZoom * 0.9, 0.05, 0.7));
}

export function zoomCameraAt(camera, zoom, screenPoint) {
  const logicalX = camera.x + screenPoint.x / camera.zoom;
  const logicalY = camera.y + screenPoint.y / camera.zoom;

  return {
    x: logicalX - screenPoint.x / zoom,
    y: logicalY - screenPoint.y / zoom,
    zoom,
  };
}

export function panCamera(camera, screenDelta) {
  return {
    x: camera.x - screenDelta.x / camera.zoom,
    y: camera.y - screenDelta.y / camera.zoom,
    zoom: camera.zoom,
  };
}

export function clampCamera(camera, bounds, viewport, minVisiblePx = 72) {
  const logicalWidth = viewport.width / camera.zoom;
  const logicalHeight = viewport.height / camera.zoom;
  const visibleX = Math.min(minVisiblePx, viewport.width) / camera.zoom;
  const visibleY = Math.min(minVisiblePx, viewport.height) / camera.zoom;

  return {
    x: clamp(
      camera.x,
      bounds.minX - logicalWidth + visibleX,
      bounds.maxX - visibleX,
    ),
    y: clamp(
      camera.y,
      bounds.minY - logicalHeight + visibleY,
      bounds.maxY - visibleY,
    ),
    zoom: camera.zoom,
  };
}

export function ensureRectVisible(camera, rect, viewport, padding = 48) {
  if (!rect) return camera;

  const view = {
    minX: camera.x,
    maxX: camera.x + viewport.width / camera.zoom,
    minY: camera.y,
    maxY: camera.y + viewport.height / camera.zoom,
  };
  let x = camera.x;
  let y = camera.y;

  if (rect.maxX < view.minX) {
    x = rect.maxX - padding / camera.zoom;
  } else if (rect.minX > view.maxX) {
    x = rect.minX - (viewport.width - padding) / camera.zoom;
  }

  if (rect.maxY < view.minY) {
    y = rect.maxY - padding / camera.zoom;
  } else if (rect.minY > view.maxY) {
    y = rect.minY - (viewport.height - padding) / camera.zoom;
  }

  return { x, y, zoom: camera.zoom };
}

export function reconcileCamera(
  camera,
  bounds,
  activeRect,
  viewport,
  padding = 48,
  minVisiblePx = 72,
) {
  const clamped = clampCamera(camera, bounds, viewport, minVisiblePx);
  const visible = ensureRectVisible(clamped, activeRect, viewport, padding);
  return clampCamera(visible, bounds, viewport, minVisiblePx);
}

export function computePinchCamera(startCamera, startTouches, currentTouches) {
  if (startTouches.length < 2 || currentTouches.length < 2) return startCamera;

  const startMidpoint = midpoint(startTouches[0], startTouches[1]);
  const currentMidpoint = midpoint(currentTouches[0], currentTouches[1]);
  const startDistance = distance(startTouches[0], startTouches[1]);
  const currentDistance = distance(currentTouches[0], currentTouches[1]);
  if (startDistance === 0 || currentDistance === 0) return startCamera;

  const zoom = startCamera.zoom * (currentDistance / startDistance);
  const anchorX = startCamera.x + startMidpoint.x / startCamera.zoom;
  const anchorY = startCamera.y + startMidpoint.y / startCamera.zoom;

  return {
    x: anchorX - currentMidpoint.x / zoom,
    y: anchorY - currentMidpoint.y / zoom,
    zoom,
  };
}

function midpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
