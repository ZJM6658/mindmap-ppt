export function handleImageButtonKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.stopPropagation();
  }
}

export function isEditableTarget(target) {
  return Boolean(
    target?.matches?.("input, button, textarea, select, [contenteditable='true'], [role='button']"),
  );
}

export function isCanvasInteractionTarget(target) {
  return !target?.closest?.(".mind-node, .floating-ui, .image-viewer");
}

export function getStepDeltaForKey(event) {
  if (isEditableTarget(event.target)) return 0;

  if (event.key === " " && event.shiftKey) return -1;
  if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) return 1;
  if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) return -1;
  return 0;
}
