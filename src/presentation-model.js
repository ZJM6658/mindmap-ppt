export function parseMarkdownTree(markdown) {
  const stack = [];
  let nextId = 0;
  let parsedRoot = null;

  markdown
    .split("\n")
    .filter((line) => line.trim())
    .forEach((line) => {
      const itemMatch = line.match(/^(\s*)-\s+(.+)$/);
      if (!itemMatch) {
        const continuationMatch = line.match(/^(\s+)(\S.*)$/);
        if (continuationMatch && stack.length > 0) {
          const indent = continuationMatch[1].replace(/\t/g, "    ").length;
          const continuationParent = findContinuationParent(stack, indent);
          const continuationText = continuationMatch[2].trim();

          if (continuationParent) {
            if (continuationText === "@unit") {
              continuationParent.isUnit = true;
              return;
            }

            if (continuationText.startsWith("@image ")) {
              continuationParent.image = resolveImagePath(continuationText.slice("@image ".length).trim());
              return;
            }

            continuationParent.label = `${continuationParent.label}\n${continuationText}`;
          }
        }

        return;
      }

      const indent = itemMatch[1].replace(/\t/g, "    ").length;

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const depth = stack.length;
      const node = {
        id: `node-${nextId++}`,
        label: itemMatch[2].trim(),
        children: [],
        parent: null,
        depth,
        image: "",
        isUnit: false,
        preorderIndex: 0,
      };

      if (depth === 0) {
        parsedRoot = node;
      } else {
        const parent = stack[depth - 1].node;
        node.parent = parent;
        parent.children.push(node);
      }

      stack.push({ node, indent });
    });

  return parsedRoot;
}

function findContinuationParent(stack, indent) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].indent <= indent) {
      return stack[index].node;
    }
  }

  return stack[stack.length - 1]?.node ?? null;
}

function resolveImagePath(path) {
  if (/^(https?:|data:|\/|\.\/|\.\.\/)/.test(path)) {
    return path;
  }

  return `./project/${path}`;
}

export function collectPreorder(node, list = []) {
  if (!node) {
    return list;
  }

  list.push(node);
  node.children.forEach((child) => collectPreorder(child, list));
  return list;
}

export function assignTreeMetadata(treeRoot) {
  collectPreorder(treeRoot).forEach((node, index) => {
    node.preorderIndex = index;
  });
}

export function buildPresentationSteps(preorder) {
  if (preorder.length === 0) {
    return [];
  }

  const unitStartIndexes = preorder.flatMap((node, index) => (node.isUnit ? [index] : []));

  if (unitStartIndexes.length === 0) {
    return preorder.map((node, index) => ({
      startIndex: index,
      endIndex: index,
      node,
    }));
  }

  if (unitStartIndexes[0] !== 0) {
    unitStartIndexes.unshift(0);
  }

  return unitStartIndexes.map((startIndex, index) => ({
    startIndex,
    endIndex: (unitStartIndexes[index + 1] ?? preorder.length) - 1,
    node: preorder[startIndex],
  }));
}

export function getPresentationState(steps, stepIndex, preorder) {
  const step = steps[stepIndex];
  if (!step) {
    return {
      activeNode: null,
      visibleEndIndex: Math.max(0, preorder.length - 1),
      isEnd: true,
    };
  }

  return {
    activeNode: step.node,
    visibleEndIndex: step.endIndex,
    isEnd: false,
  };
}
