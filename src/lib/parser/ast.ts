import YAML from "yaml";
import { Position } from "../../types";

import { PropertyPath } from "../utils/path";

export const DUMMY_KEY = "dummy";

export function inPos(position: Position, pos: number): boolean {
  return position[0] <= pos && pos <= position[1];
}

YAML.Document;

export function findNode(node: YAML.Node, pos: number): YAML.Node | null {
  let result: YAML.Node | null = null;

  YAML.visit(node, {
    Node: (key, node, path) => {
      if (!node.range) {
        throw new Error("Node has no range");
      }

      if (inPos([node.range![0], node.range![2]], pos)) {
        result = node;
      }
    },
  });

  return result;
}

export function getPathFromNode(
  doc: YAML.Document,
  node: YAML.Node | null
): PropertyPath {
  let ancestry: readonly (YAML.Document | YAML.Node | YAML.Pair)[] = [];

  YAML.visit(doc, {
    Node: (key, n, path) => {
      if (n === node) {
        ancestry = path;
        return YAML.visit.BREAK;
      }
    },
  });

  const path: PropertyPath = ["$"];
  for (const n of ancestry) {
    if (YAML.isPair<YAML.ParsedNode, YAML.ParsedNode>(n)) {
      path.push((n.key as YAML.Scalar).value as string); // TODO: Is key always a string?
    }

    if (YAML.isSeq(n)) {
      // TODO: Support sequences
      // /// Check next node to determine index
      // if (nodePath.length && x.items) {
      //   const idx = x.items.indexOf(nodePath[0]);
      //   if (idx !== -1) {
      //     // Previous entry has to be a property. Note: this might be problematic with nested sequences,
      //     // but that's not currently supported.
      //     const propertyName: string = path[path.length - 1] as string;
      //     path[path.length - 1] = [propertyName, idx];
      //   }
      // }
    }
  }

  return path;
}
