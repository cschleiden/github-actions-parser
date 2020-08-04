import { Kind, YAMLNode, YNode } from "../../types";
import { Position } from "./types";

export function inPos(position: Position, pos: number): boolean {
  return position[0] <= pos && pos <= position[1];
}

export function findNode(node: YAMLNode, pos: number): YAMLNode {
  if (!inPos([node.startPosition, node.endPosition], pos)) {
    return null;
  }

  const n: YNode = node as YNode;
  switch (n.kind) {
    case Kind.MAP: {
      for (const mapping of n.mappings) {
        if (inPos([mapping.startPosition, mapping.endPosition], pos)) {
          return findNode(mapping, pos);
        }
      }

      break;
    }

    case Kind.MAPPING: {
      // If the position is within the value, return that, otherwise the mapping node
      const r = node.value && findNode(n.value, pos);
      if (r) {
        return r;
      }

      // TODO: What to do here..
      if (node.key) {
        if (
          inPos([n.key.startPosition, n.key.endPosition], pos) ||
          node.key.value === "dummy"
        ) {
          return node.parent;
        }
      }

      break;
    }

    case Kind.SEQ: {
      for (const item of n.items) {
        if (typeof item !== "object") {
          return n;
        }

        if (item === null) {
          // New item like `- |` is inserted
          return n;
        }

        if (inPos([item.startPosition, item.endPosition], pos)) {
          const itemNode = findNode(item, pos);

          // TODO: CS: Try to get rid of this logic
          // if (itemNode.parent === n && itemNode.kind === Kind.SCALAR) {
          //   // If the child is a plain value, return the sequence node
          //   // return n;
          // }

          // Otherwise return the found node
          return itemNode;
        }
      }

      break;
    }

    case Kind.SCALAR: {
      if (n.value && n.value === "dummy") {
        return n.parent;
      }

      return n;
    }

    default:
      throw new Error("unknown");
  }

  return node;
}
