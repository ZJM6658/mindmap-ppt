export function handleImageButtonKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.stopPropagation();
  }
}
